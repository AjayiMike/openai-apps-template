import http from "node:http";
import fsSync from "node:fs";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const DIST_HTML_PATH = path.resolve(process.cwd(), "dist", "todo.html");
const SSE_PATH = "/mcp";
const POST_PATH = "/mcp/messages";

function readHtml(): string {
    if (!fsSync.existsSync(DIST_HTML_PATH)) {
        throw new Error("Build not found. Run `npm run build` first.");
    }
    return fsSync.readFileSync(DIST_HTML_PATH, "utf8");
}

const TOOLS = {
    LIST: "todo-list",
    ADD: "add_todo",
    TOGGLE: "toggle_todo",
    DELETE: "delete_todo",
};

const widget = {
    id: TOOLS.LIST,
    title: "Show Todo List",
    templateUri: "ui://widget/todo.html",
    get html(): string {
        return readHtml();
    },
    responseText: "Rendered a todo list!",
};

function metaDescriptor() {
    return {
        "openai/outputTemplate": widget.templateUri,
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
    };
}

function metaInvocation() {
    return {
        "openai/toolInvocation/invoking": "Rendering…",
        "openai/toolInvocation/invoked": "Rendered",
    };
}

type TodoItem = {
    id: string;
    title: string;
    isComplete: boolean;
};

type TodoList = {
    id: string;
    title: string;
    isCurrentlyOpen: boolean;
    todos: TodoItem[];
};

type ToolArguments = {
    title?: string;
    listId?: string;
    todoId?: string;
};

function cloneList(list: TodoList): TodoList {
    return {
        ...list,
        todos: list.todos.map((todo) => ({ ...todo })),
    };
}

function createInitialLists(): TodoList[] {
    return [
        {
            id: "list-root",
            title: "My List",
            isCurrentlyOpen: true,
            todos: [],
        },
    ];
}

function cloneLists(lists: TodoList[]): TodoList[] {
    return lists.map((list) => cloneList(list));
}

function generateId(prefix: "list" | "todo"): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getNormalizedTitle(title?: string): string {
    if (typeof title === "string" && title.trim().length > 0) {
        return title.trim();
    }
    return "New item";
}

const globalTodoState: { todoLists: TodoList[] } = {
    todoLists: createInitialLists(),
};

function ensureList(todoLists: TodoList[], listId?: string): TodoList {
    if (listId) {
        const hit = todoLists.find((list) => list.id === listId);
        if (hit) return hit;
    }
    if (todoLists.length === 0) {
        const newList: TodoList = {
            id: generateId("list"),
            title: "My List",
            isCurrentlyOpen: true,
            todos: [],
        };
        todoLists.push(newList);
        return newList;
    }
    return todoLists[0];
}

function toolResponse(todoLists: TodoList[]) {
    return {
        content: [{ type: "text", text: widget.responseText }],
        structuredContent: {
            todoLists: cloneLists(todoLists),
        },
        _meta: metaInvocation(),
    };
}

function createMcpServer(): Server {
    const server = new Server(
        { name: "todo", version: "0.1.0" },
        { capabilities: { resources: {}, tools: {} } }
    );
    const todoLists: TodoList[] = globalTodoState.todoLists;

    const toolDescriptors = [
        {
            name: TOOLS.LIST,
            title: "Show Todo List",
            description: "Return the current todo lists",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
        },
        {
            name: TOOLS.ADD,
            title: "Add Todo",
            description: "Add a todo item to a list",
            inputSchema: {
                type: "object",
                properties: {
                    listId: {
                        type: "string",
                        description:
                            "Target list identifier. Defaults to the primary list.",
                    },
                    title: {
                        type: "string",
                        description: "Title for the todo item.",
                    },
                },
                required: ["title"],
                additionalProperties: false,
            },
        },
        {
            name: TOOLS.TOGGLE,
            title: "Toggle Todo",
            description: "Toggle completion state of a todo item",
            inputSchema: {
                type: "object",
                properties: {
                    listId: {
                        type: "string",
                        description: "Identifier of the target list.",
                    },
                    todoId: {
                        type: "string",
                        description: "Identifier of the todo item to toggle.",
                    },
                },
                required: ["listId", "todoId"],
                additionalProperties: false,
            },
        },
        {
            name: TOOLS.DELETE,
            title: "Delete Todo",
            description: "Delete a todo item from a list",
            inputSchema: {
                type: "object",
                properties: {
                    listId: {
                        type: "string",
                        description: "Identifier of the target list.",
                    },
                    todoId: {
                        type: "string",
                        description: "Identifier of the todo item to delete.",
                    },
                },
                required: ["listId", "todoId"],
                additionalProperties: false,
            },
        },
    ];

    server.setRequestHandler(ListToolsRequestSchema, async (_req: any) => ({
        tools: toolDescriptors.map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            _meta: metaDescriptor(),
            annotations: {
                destructiveHint: tool.name === TOOLS.DELETE,
                openWorldHint: false,
                readOnlyHint: tool.name === TOOLS.LIST,
            },
        })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
        const toolName = req.params.name;
        const args: ToolArguments = req.params.arguments ?? {};

        if (toolName === TOOLS.LIST) {
            return toolResponse(todoLists);
        }

        if (toolName === TOOLS.ADD) {
            const targetList = ensureList(todoLists, args.listId);
            const title = getNormalizedTitle(args.title);
            targetList.todos = [
                { id: generateId("todo"), title, isComplete: false },
                ...targetList.todos,
            ];
            return toolResponse(todoLists);
        }

        if (toolName === TOOLS.TOGGLE) {
            const targetList = ensureList(todoLists, args.listId);
            if (!args.todoId) throw new Error("Missing todoId for toggle");
            const todo = targetList.todos.find(
                (item) => item.id === args.todoId
            );
            if (!todo) throw new Error("Todo not found for toggle action");
            todo.isComplete = !todo.isComplete;
            return toolResponse(todoLists);
        }

        if (toolName === TOOLS.DELETE) {
            const targetList = ensureList(todoLists, args.listId);
            if (!args.todoId) throw new Error("Missing todoId for delete");
            targetList.todos = targetList.todos.filter(
                (item) => item.id !== args.todoId
            );
            return toolResponse(todoLists);
        }

        throw new Error(`Unknown tool: ${toolName}`);
    });

    server.setRequestHandler(ListResourcesRequestSchema, async (_req: any) => ({
        resources: [
            {
                uri: widget.templateUri,
                name: widget.title,
                description: "Todo widget HTML",
                mimeType: "text/html+skybridge",
                _meta: metaDescriptor(),
            },
        ],
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (req: any) => {
        if (req.params.uri !== widget.templateUri)
            throw new Error("Unknown resource");
        return {
            contents: [
                {
                    uri: widget.templateUri,
                    mimeType: "text/html+skybridge",
                    text: widget.html,
                    _meta: metaDescriptor(),
                },
            ],
        };
    });

    return server;
}

type SessionRecord = {
    server: Server;
    transport: SSEServerTransport;
};
const sessions = new Map<string, SessionRecord>(); // sessionId -> record

async function handleSse(res: any) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const server = createMcpServer();
    const transport = new SSEServerTransport(POST_PATH, res);
    const sessionId = transport.sessionId;
    sessions.set(sessionId, { server, transport });
    transport.onclose = async () => {
        sessions.delete(sessionId);
        await server.close();
    };
    transport.onerror = (err) => console.error("SSE error:", err);
    await server.connect(transport);
}

async function handlePost(req: any, res: any, url: any) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return res.writeHead(400).end("Missing sessionId");
    const session = sessions.get(sessionId);
    if (!session) return res.writeHead(404).end("Unknown session");
    try {
        await session.transport.handlePostMessage(req, res);
    } catch (err) {
        console.error("POST error:", err);
        if (!res.headersSent)
            res.writeHead(500).end("Failed to process message");
    }
}

const port = Number.isFinite(Number(process.env.PORT))
    ? Number(process.env.PORT)
    : 8000;
const httpServer = http.createServer(async (req: any, res: any) => {
    if (!req.url) return res.writeHead(400).end("Missing URL");
    const url = new (globalThis as any).URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
    );

    // CORS preflight
    if (
        req.method === "OPTIONS" &&
        (url.pathname === SSE_PATH || url.pathname === POST_PATH)
    ) {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
        });
        return res.end();
    }

    if (req.method === "GET" && url.pathname === SSE_PATH)
        return handleSse(res);
    if (req.method === "POST" && url.pathname === POST_PATH)
        return handlePost(req, res, url);
    return res.writeHead(404).end("Not Found");
});

httpServer.on("clientError", (err: any, socket: any) => {
    console.error("HTTP client error", err);
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
    console.log(`MCP server listening on http://localhost:${port}`);
    console.log(`  SSE:  GET  http://localhost:${port}${SSE_PATH}`);
    console.log(
        `  POST: POST http://localhost:${port}${POST_PATH}?sessionId=...`
    );
});
