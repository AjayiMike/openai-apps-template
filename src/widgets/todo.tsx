import { useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import TodoItem from "../components/TodoItem";
import { useCallTool } from "../hooks/use-call-tool";
import { useWidgetProps } from "../hooks/use-widget-props";
import { useWidgetState } from "../hooks/use-widget-state";

// const TOOL_LIST = "todo-list";
// const TOOL_ADD = "add-todo";
// const TOOL_TOGGLE = "toggle-todo";
// const TOOL_DELETE = "delete-todo";

const TOOLS = {
    LIST: "todo-list",
    ADD: "add-todo",
    TOGGLE: "toggle-todo",
    DELETE: "delete-todo",
};
type TodoEntry = {
    id: string;
    title: string;
    isComplete: boolean;
};
type TodoList = {
    id: string;
    title: string;
    isCurrentlyOpen?: boolean;
    todos: TodoEntry[];
};

function readStructuredLists(structured: unknown): TodoList[] | null {
    if (
        structured &&
        typeof structured === "object" &&
        Array.isArray((structured as any).todoLists)
    ) {
        return (structured as any).todoLists as TodoList[];
    }
    return null;
}

function isNonEmptyListArray(
    value: TodoList[] | null | undefined
): value is TodoList[] {
    return Array.isArray(value) && value.length > 0;
}

function areListsEqual(a: TodoList[] | null, b: TodoList[] | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        const listA = a[i];
        const listB = b[i];
        if (
            listA.id !== listB.id ||
            listA.title !== listB.title ||
            !!listA.isCurrentlyOpen !== !!listB.isCurrentlyOpen ||
            listA.todos.length !== listB.todos.length
        ) {
            return false;
        }
        for (let j = 0; j < listA.todos.length; j += 1) {
            const todoA = listA.todos[j];
            const todoB = listB.todos[j];
            if (
                todoA.id !== todoB.id ||
                todoA.title !== todoB.title ||
                !!todoA.isComplete !== !!todoB.isComplete
            ) {
                return false;
            }
        }
    }
    return true;
}

function readPreviewData() {
    if (
        typeof window !== "undefined" &&
        window.todoData &&
        Array.isArray(window.todoData.todoLists)
    ) {
        return window.todoData.todoLists as Array<any>;
    }
    return [] as Array<any>;
}

function Todo() {
    const previewLists = useMemo(() => readPreviewData(), []);
    const fallbackLists = useMemo(
        () =>
            previewLists.length > 0
                ? previewLists
                : [
                      {
                          id: "list-local",
                          title: "My List",
                          isCurrentlyOpen: true,
                          todos: [],
                      },
                  ],
        [previewLists]
    );
    const widgetProps = useWidgetProps<{ todoLists?: TodoList[] }>();
    const toolOutputLists = Array.isArray(widgetProps?.todoLists)
        ? (widgetProps.todoLists as TodoList[])
        : null;
    const callTool = useCallTool();
    const lastToolSyncRef = useRef<TodoList[] | null>(null);

    const [widgetState, setWidgetState] = useWidgetState<{
        todoLists: TodoList[];
    }>(() => ({ todoLists: fallbackLists }));
    const widgetStateLists =
        widgetState && Array.isArray(widgetState.todoLists)
            ? widgetState.todoLists
            : null;

    const resolvedLists = isNonEmptyListArray(widgetStateLists)
        ? widgetStateLists
        : isNonEmptyListArray(toolOutputLists)
        ? toolOutputLists
        : fallbackLists;

    const syncWithTool = async (
        toolName: string,
        payload: Record<string, unknown>
    ) => {
        try {
            const response = await callTool(toolName, payload);
            const serverLists = readStructuredLists(
                response?.structuredContent ?? null
            );
            if (isNonEmptyListArray(serverLists)) {
                setWidgetState({ todoLists: serverLists });
            }
        } catch (error) {
            console.error("Failed to sync with todo tool", error);
        }
    };

    useEffect(() => {
        if (!isNonEmptyListArray(toolOutputLists)) {
            lastToolSyncRef.current = null;
            return;
        }

        if (
            lastToolSyncRef.current &&
            areListsEqual(lastToolSyncRef.current, toolOutputLists)
        ) {
            return;
        }

        lastToolSyncRef.current = toolOutputLists.map((list) => ({
            ...list,
            todos: list.todos.map((todo) => ({ ...todo })),
        }));
        setWidgetState({ todoLists: toolOutputLists });
    }, [setWidgetState, toolOutputLists]);

    const toggleItem = (listId: string, itemId: string) => {
        const next = resolvedLists.map((l) => {
            if (l.id !== listId) return l;
            return {
                ...l,
                todos: l.todos.map((t: TodoEntry) =>
                    t.id === itemId ? { ...t, isComplete: !t.isComplete } : t
                ),
            };
        });
        setWidgetState({ todoLists: next });
        void syncWithTool(TOOLS.TOGGLE, { listId, todoId: itemId });
    };

    const addItem = (listId: string, title: string) => {
        const normalizedTitle =
            title && title.trim().length > 0 ? title : "New item";
        const next = resolvedLists.map((l) => {
            if (l.id !== listId) return l;
            const id = `todo-${Math.random().toString(36).slice(2, 8)}`;
            return {
                ...l,
                todos: [
                    {
                        id,
                        title: normalizedTitle,
                        isComplete: false,
                    },
                    ...l.todos,
                ],
            };
        });
        setWidgetState({ todoLists: next });
        void syncWithTool(TOOLS.ADD, { listId, title: normalizedTitle });
    };

    const deleteItem = (listId: string, todoId: string) => {
        const next = resolvedLists.map((l) => {
            if (l.id !== listId) return l;
            return {
                ...l,
                todos: l.todos.filter((t: TodoEntry) => t.id !== todoId),
            };
        });
        setWidgetState({ todoLists: next });
        void syncWithTool(TOOLS.DELETE, { listId, todoId });
    };

    return (
        <div className="w-full h-full p-4">
            {resolvedLists.map((list: any) => (
                <TodoItem
                    key={list.id}
                    list={list}
                    addItem={addItem}
                    toggleItem={toggleItem}
                    deleteItem={deleteItem}
                />
            ))}
        </div>
    );
}

const ROOT_ID =
    typeof __WIDGET_ROOT_ID__ !== "undefined"
        ? __WIDGET_ROOT_ID__
        : "todo-root";
createRoot(document.getElementById(ROOT_ID) as HTMLElement).render(<Todo />);
export default Todo;
