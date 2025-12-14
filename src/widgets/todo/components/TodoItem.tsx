import React from "react";
import recycleBin_black from "../../../assets/recycle-bin-black.png";
import recycleBin_white from "../../../assets/recycle-bin-white.png";
import { TodoEntry } from "..";

interface TodoItemProps {
    todoItem: TodoEntry;
    toggleItem: (itemId: string) => void;
    deleteItem: (itemId: string) => void;
    isDark: boolean;
}

const TodoItem: React.FC<TodoItemProps> = ({
    todoItem,
    toggleItem,
    deleteItem,
    isDark,
}) => {
    const borderColor = isDark ? "border-white/10" : "border-black/10";
    const completedClass = todoItem.isComplete
        ? isDark
            ? "line-through text-white/50"
            : "line-through text-black/50"
        : "";
    const deleteColor = isDark
        ? "text-red-300 hover:text-red-200"
        : "text-red-500 hover:text-red-600";

    return (
        <li
            className={`flex items-center gap-2 py-2 border-t first:border-t-0 ${borderColor}`}
        >
            <input
                className="w-3.5 h-3.5 cursor-pointer"
                type="checkbox"
                readOnly
                checked={!!todoItem.isComplete}
                onChange={() => toggleItem(todoItem.id)}
                style={{ accentColor: isDark ? "#ffffff" : "#111111" }}
            />
            <span
                role="button"
                tabIndex={0}
                onClick={() => toggleItem(todoItem.id)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleItem(todoItem.id);
                    }
                }}
                className={`flex-1 cursor-pointer ${completedClass}`}
            >
                {todoItem.title || "Untitled"}
            </span>
            <button
                type="button"
                className={`text-xs cursor-pointer transition-colors ${deleteColor}`}
                onClick={() => deleteItem(todoItem.id)}
            >
                <img
                    src={isDark ? recycleBin_white : recycleBin_black}
                    alt="Delete"
                    className="w-4 h-4"
                />
            </button>
        </li>
    );
};

export default TodoItem;
