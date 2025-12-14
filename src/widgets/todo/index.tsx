import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";
import { createRoot } from "react-dom/client";
import TodoItem from "./components/TodoItem";
import { useCallTool } from "../../hooks/use-call-tool";
import { useWidgetProps } from "../../hooks/use-widget-props";
import { useWidgetState } from "../../hooks/use-widget-state";
import { useDisplayMode } from "../../hooks/use-display-mode";
import { useMaxHeight } from "../../hooks/use-max-height";
import { useOpenAiGlobal } from "../../hooks/use-openai-global";
import NewTodo from "./components/NewTodo";

const TOOLS = {
    LIST: "list_todos",
    ADD: "add_todo_item",
    TOGGLE: "toggle_todo_item",
    DELETE: "delete_todo_item",
};
export type TodoEntry = {
    id: string;
    title: string;
    isComplete: boolean;
};
type TodoList = {
    title: string;
    todos: TodoEntry[];
};

function cloneList(list: TodoList): TodoList {
    return {
        ...list,
        todos: list.todos.map((todo) => ({ ...todo })),
    };
}

function readStructuredList(structured: unknown): TodoList | null {
    if (
        structured &&
        typeof structured === "object" &&
        structured !== null &&
        typeof (structured as any).todoList === "object"
    ) {
        return (structured as any).todoList as TodoList;
    }
    return null;
}

function isValidList(value: TodoList | null | undefined): value is TodoList {
    return !!value && Array.isArray(value.todos);
}

function areListsEqual(a: TodoList | null, b: TodoList | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.title !== b.title || a.todos.length !== b.todos.length) {
        return false;
    }
    for (let i = 0; i < a.todos.length; i += 1) {
        const todoA = a.todos[i];
        const todoB = b.todos[i];
        if (
            todoA.id !== todoB.id ||
            todoA.title !== todoB.title ||
            !!todoA.isComplete !== !!todoB.isComplete
        ) {
            return false;
        }
    }
    return true;
}

function readPreviewData(): TodoList | null {
    if (
        typeof window !== "undefined" &&
        window.todoData &&
        typeof window.todoData.todoList === "object"
    ) {
        return window.todoData.todoList as TodoList;
    }
    return null;
}

function Todo() {
    const [newTodoTitle, setNewTodoTitle] = useState("");
    const displayMode = useDisplayMode();
    const maxHeight = useMaxHeight();
    const theme = useOpenAiGlobal("theme") ?? "light";
    const safeArea = useOpenAiGlobal("safeArea");
    const safeInsets = safeArea?.insets ?? {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    };
    const isDark = theme === "dark";
    const previewList = useMemo(() => readPreviewData(), []);
    const fallbackList = useMemo(
        () =>
            previewList ?? {
                title: "My Todo List",
                todos: [],
            },
        [previewList]
    );
    const widgetProps = useWidgetProps<{ todoList?: TodoList }>();
    const toolOutputList =
        widgetProps && isValidList(widgetProps.todoList)
            ? (widgetProps.todoList as TodoList)
            : null;
    const callTool = useCallTool();
    const lastToolSyncRef = useRef<TodoList | null>(null);

    const [widgetState, setWidgetState] = useWidgetState<{
        todoList: TodoList;
    }>(() => ({ todoList: fallbackList }));
    const widgetStateList =
        widgetState && isValidList(widgetState.todoList)
            ? widgetState.todoList
            : null;

    const resolvedList = widgetStateList ?? toolOutputList ?? fallbackList;

    const syncWithTool = async (
        toolName: string,
        payload: Record<string, unknown>
    ) => {
        try {
            const response = await callTool(toolName, payload);
            const serverList = readStructuredList(
                response?.structuredContent ?? null
            );
            if (isValidList(serverList)) {
                setWidgetState({ todoList: serverList });
            }
        } catch (error) {
            console.error("Failed to sync with todo tool", error);
        }
    };

    useEffect(() => {
        if (!isValidList(toolOutputList)) {
            lastToolSyncRef.current = null;
            return;
        }

        if (
            lastToolSyncRef.current &&
            areListsEqual(lastToolSyncRef.current, toolOutputList)
        ) {
            return;
        }

        lastToolSyncRef.current = cloneList(toolOutputList);
        setWidgetState({ todoList: toolOutputList });
    }, [setWidgetState, toolOutputList]);

    const handleAdd = async () => {
        const title = newTodoTitle.trim();
        if (!title) return;
        addItem(title);
        setNewTodoTitle("");
    };

    const handleNewTodoKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (
        e
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    };

    const toggleItem = (itemId: string) => {
        const next: TodoList = {
            ...resolvedList,
            todos: resolvedList.todos.map((todo: TodoEntry) =>
                todo.id === itemId
                    ? { ...todo, isComplete: !todo.isComplete }
                    : todo
            ),
        };
        setWidgetState({ todoList: next });
        void syncWithTool(TOOLS.TOGGLE, { todoId: itemId });
    };

    const addItem = (title: string) => {
        const normalizedTitle =
            title && title.trim().length > 0 ? title : "New item";
        const id = `todo-${Math.random().toString(36).slice(2, 8)}`;
        const next: TodoList = {
            ...resolvedList,
            todos: [
                {
                    id,
                    title: normalizedTitle,
                    isComplete: false,
                },
                ...resolvedList.todos,
            ],
        };
        setWidgetState({ todoList: next });
        void syncWithTool(TOOLS.ADD, { title: normalizedTitle });
    };

    const deleteItem = (todoId: string) => {
        const next: TodoList = {
            ...resolvedList,
            todos: resolvedList.todos.filter(
                (todo: TodoEntry) => todo.id !== todoId
            ),
        };
        setWidgetState({ todoList: next });
        void syncWithTool(TOOLS.DELETE, { todoId });
    };

    const containerStyle: CSSProperties = {
        paddingTop: 16 + safeInsets.top,
        paddingBottom: 16 + safeInsets.bottom,
        paddingLeft: 16 + safeInsets.left,
        paddingRight: 16 + safeInsets.right,
        boxSizing: "border-box",
    };
    if (maxHeight) {
        containerStyle.maxHeight = maxHeight;
        containerStyle.overflowY = "auto";
    }

    const cardWidthClass =
        displayMode === "fullscreen"
            ? "max-w-[640px]"
            : displayMode === "pip"
            ? "max-w-[360px]"
            : "max-w-[480px]";
    const cardPaddingClass =
        displayMode === "fullscreen"
            ? "p-5"
            : displayMode === "pip"
            ? "p-3"
            : "p-4";
    const headingSizeClass =
        displayMode === "fullscreen" ? "text-lg" : "text-base";

    return (
        <div
            className="w-full h-full transition-colors duration-200 bg-transparent"
            style={containerStyle}
        >
            <div
                className={`border rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] mx-auto ${cardWidthClass} ${cardPaddingClass} transition-colors duration-200 ${
                    isDark
                        ? "bg-[#111214] border-white/10 text-white"
                        : "bg-white border-black/10 text-black"
                }`}
            >
                <div className="flex items-center gap-2 py-2">
                    <div className={`font-semibold flex-1 ${headingSizeClass}`}>
                        {resolvedList.title || "Untitled"}
                    </div>
                </div>
                <NewTodo
                    newTodoTitle={newTodoTitle}
                    setNewTodoTitle={setNewTodoTitle}
                    handleNewTodoKeyDown={handleNewTodoKeyDown}
                    handleAdd={handleAdd}
                    isDark={isDark}
                />
                <ul className="list-none p-0 m-0">
                    {resolvedList.todos.map((item: TodoEntry) => (
                        <TodoItem
                            key={item.id}
                            todoItem={item}
                            toggleItem={toggleItem}
                            deleteItem={deleteItem}
                            isDark={isDark}
                        />
                    ))}
                    {resolvedList.todos.length === 0 && (
                        <li
                            className={`py-2 ${
                                isDark ? "text-white/45" : "text-black/45"
                            }`}
                        >
                            No items yet
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}

const ROOT_ID =
    typeof __WIDGET_ROOT_ID__ !== "undefined"
        ? __WIDGET_ROOT_ID__
        : "todo-root";
createRoot(document.getElementById(ROOT_ID) as HTMLElement).render(<Todo />);
export default Todo;
