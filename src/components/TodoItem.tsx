import React, { useState } from "react";

interface TodoItemProps {
    list: {
        id: string;
        title: string;
        todos: { id: string; title: string; isComplete: boolean }[];
    };
    addItem: (listId: string, title: string) => Promise<void> | void;
    toggleItem: (listId: string, itemId: string) => void;
    deleteItem: (listId: string, itemId: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({
    list,
    addItem,
    toggleItem,
    deleteItem,
}) => {
    const [newTitle, setNewTitle] = useState("");

    const handleAdd = async () => {
        const title = newTitle.trim();
        if (!title) return;
        await addItem(list.id, title);
        setNewTitle("");
    };

    const triggerAdd = () => {
        handleAdd().catch((error) =>
            console.error("Failed to add todo item", error)
        );
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            triggerAdd();
        }
    };

    return (
        <div
            key={list.id}
            className="bg-white border border-black/10 rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] p-3 max-w-[480px] mx-auto"
        >
            <div className="flex items-center gap-2 py-2">
                <div className="font-semibold text-base flex-1">
                    {list.title || "Untitled"}
                </div>
            </div>
            <div className="flex items-center gap-2 pb-2">
                <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="New item title…"
                    className="flex-1 border border-black/15 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                />
                <button
                    className="bg-black text-white rounded-md px-2.5 py-1.5 text-sm disabled:opacity-40"
                    onClick={triggerAdd}
                    disabled={!newTitle.trim()}
                >
                    + Add
                </button>
            </div>
            <ul className="list-none p-0 m-0">
                {list.todos.map((item: any) => (
                    <li
                        key={item.id}
                        className="flex items-center gap-2 py-2 border-t border-black/10 first:border-t-0"
                    >
                        <input
                            className="w-3.5 h-3.5"
                            type="checkbox"
                            readOnly
                            checked={!!item.isComplete}
                            onChange={() => toggleItem(list.id, item.id)}
                        />
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleItem(list.id, item.id)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleItem(list.id, item.id);
                                }
                            }}
                            className={`flex-1 cursor-pointer ${
                                item.isComplete
                                    ? "line-through text-black/50"
                                    : ""
                            }`}
                        >
                            {item.title || "Untitled"}
                        </span>
                        <button
                            type="button"
                            className="text-xs text-red-500 hover:text-red-600"
                            onClick={() => deleteItem(list.id, item.id)}
                        >
                            Delete
                        </button>
                    </li>
                ))}
                {list.todos.length === 0 && (
                    <li className="py-2 text-black/45">No items yet</li>
                )}
            </ul>
        </div>
    );
};

export default TodoItem;
