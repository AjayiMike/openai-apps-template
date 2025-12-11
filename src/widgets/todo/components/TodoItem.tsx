import React, { useState } from "react";
import recycleBin from "../../../assets/recycle-bin.png";
import TextInput from "../../../components/TextInput";

type TodoList = {
    title: string;
    todos: { id: string; title: string; isComplete: boolean }[];
};

interface TodoItemProps {
    list: TodoList;
    addItem: (title: string) => Promise<void> | void;
    toggleItem: (itemId: string) => void;
    deleteItem: (itemId: string) => void;
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
        await addItem(title);
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
        <div className="bg-white border border-black/10 rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] p-3 max-w-[480px] mx-auto">
            <div className="flex items-center gap-2 py-2">
                <div className="font-semibold text-base flex-1">
                    {list.title || "Untitled"}
                </div>
            </div>
            <div className="flex items-center gap-2 pb-2">
                <TextInput
                    value={newTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewTitle(e.target.value)
                    }
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                        handleKeyDown(e)
                    }
                    placeholder="New item title…"
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
                            className="w-3.5 h-3.5 cursor-pointer"
                            type="checkbox"
                            readOnly
                            checked={!!item.isComplete}
                            onChange={() => toggleItem(item.id)}
                        />
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleItem(item.id)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleItem(item.id);
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
                            className="text-xs text-red-500 hover:text-red-600 cursor-pointer"
                            onClick={() => deleteItem(item.id)}
                        >
                            <img
                                src={recycleBin}
                                alt="Delete"
                                className="w-4 h-4"
                            />
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
