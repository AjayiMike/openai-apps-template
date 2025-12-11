import React from "react";
import recycleBin from "../../../assets/recycle-bin.png";
import { TodoEntry } from "..";

interface TodoItemProps {
    todoItem: TodoEntry;
    toggleItem: (itemId: string) => void;
    deleteItem: (itemId: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({
    todoItem,
    toggleItem,
    deleteItem,
}) => {
    return (
        <li className="flex items-center gap-2 py-2 border-t border-black/10 first:border-t-0">
            <input
                className="w-3.5 h-3.5 cursor-pointer"
                type="checkbox"
                readOnly
                checked={!!todoItem.isComplete}
                onChange={() => toggleItem(todoItem.id)}
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
                className={`flex-1 cursor-pointer ${
                    todoItem.isComplete ? "line-through text-black/50" : ""
                }`}
            >
                {todoItem.title || "Untitled"}
            </span>
            <button
                type="button"
                className="text-xs text-red-500 hover:text-red-600 cursor-pointer"
                onClick={() => deleteItem(todoItem.id)}
            >
                <img src={recycleBin} alt="Delete" className="w-4 h-4" />
            </button>
        </li>
    );
};

export default TodoItem;
