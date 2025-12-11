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
    LIST: "todo_list",
    ADD: "add_todo_item",
    TOGGLE: "toggle_todo_item",
    DELETE: "delete_todo_item",
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
    title: string;
    todos: TodoItem[];
};

type ToolArguments = {
    title?: string;
    todoId?: string;
};

function cloneList(list: TodoList): TodoList {
    return {
        ...list,
        todos: list.todos.map((todo) => ({ ...todo })),
    };
}

function createInitialList(): TodoList {
    return {
        title: "My List",
        todos: [],
    };
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

const globalTodoState: { todoList: TodoList } = {
    todoList: createInitialList(),
};

function ensureList(todoList: TodoList | null | undefined): TodoList {
    if (todoList) {
        return todoList;
    }
    const fresh = createInitialList();
    globalTodoState.todoList = fresh;
    return fresh;
}

function toolResponse(todoList: TodoList) {
    return {
        content: [{ type: "text", text: widget.responseText }],
        structuredContent: {
            todoList: cloneList(todoList),
        },
        _meta: metaInvocation(),
    };
}

function createMcpServer(): Server {
    const server = new Server(
        { name: "todo", version: "0.1.0" },
        { capabilities: { resources: {}, tools: {} } }
    );
    const toolDescriptors = [
        {
            name: TOOLS.LIST,
            title: "Show Todo List",
            description: "Return the current todo list",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
        },
        {
            name: TOOLS.ADD,
            title: "Add Todo",
            description: "Add a todo item to the list",
            inputSchema: {
                type: "object",
                properties: {
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
                    todoId: {
                        type: "string",
                        description: "Identifier of the todo item to toggle.",
                    },
                },
                required: ["todoId"],
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
                    todoId: {
                        type: "string",
                        description: "Identifier of the todo item to delete.",
                    },
                },
                required: ["todoId"],
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
            const currentList = ensureList(globalTodoState.todoList);
            globalTodoState.todoList = currentList;
            return toolResponse(currentList);
        }

        if (toolName === TOOLS.ADD) {
            const targetList = ensureList(globalTodoState.todoList);
            globalTodoState.todoList = targetList;
            const title = getNormalizedTitle(args.title);
            targetList.todos = [
                { id: generateId("todo"), title, isComplete: false },
                ...targetList.todos,
            ];
            return toolResponse(targetList);
        }

        if (toolName === TOOLS.TOGGLE) {
            const targetList = ensureList(globalTodoState.todoList);
            globalTodoState.todoList = targetList;
            if (!args.todoId) throw new Error("Missing todoId for toggle");
            const todo = targetList.todos.find(
                (item) => item.id === args.todoId
            );
            if (!todo) throw new Error("Todo not found for toggle action");
            todo.isComplete = !todo.isComplete;
            return toolResponse(targetList);
        }

        if (toolName === TOOLS.DELETE) {
            const targetList = ensureList(globalTodoState.todoList);
            globalTodoState.todoList = targetList;
            if (!args.todoId) throw new Error("Missing todoId for delete");
            targetList.todos = targetList.todos.filter(
                (item) => item.id !== args.todoId
            );
            return toolResponse(targetList);
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
