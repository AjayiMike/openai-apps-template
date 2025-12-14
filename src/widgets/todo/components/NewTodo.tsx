import React from "react";
import TextInput from "../../../components/TextInput";

interface NewTodoProps {
    newTodoTitle: string;
    setNewTodoTitle: (title: string) => void;
    handleNewTodoKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    handleAdd: () => void;
    isDark: boolean;
}

const NewTodo: React.FC<NewTodoProps> = ({
    newTodoTitle,
    setNewTodoTitle,
    handleNewTodoKeyDown,
    handleAdd,
    isDark,
}) => {
    const buttonClasses = isDark
        ? "bg-white text-black hover:bg-white/90 focus:ring-white/40"
        : "bg-black text-white hover:bg-black/90 focus:ring-black/30";

    return (
        <div className="flex items-center gap-2 pb-2">
            <TextInput
                value={newTodoTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewTodoTitle(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                    handleNewTodoKeyDown(e)
                }
                placeholder="New item title…"
                appearance={isDark ? "dark" : "light"}
            />
            <button
                className={`rounded-md px-2.5 py-1.5 text-sm disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-transparent transition-colors ${buttonClasses}`}
                onClick={handleAdd}
                disabled={!newTodoTitle.trim()}
            >
                + Add
            </button>
        </div>
    );
};

export default NewTodo;
