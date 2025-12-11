import React from "react";
import TextInput from "../../../components/TextInput";

interface NewTodoProps {
    newTodoTitle: string;
    setNewTodoTitle: (title: string) => void;
    handleNewTodoKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    handleAdd: () => void;
}

const NewTodo: React.FC<NewTodoProps> = ({
    newTodoTitle,
    setNewTodoTitle,
    handleNewTodoKeyDown,
    handleAdd,
}) => {
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
            />
            <button
                className="bg-black text-white rounded-md px-2.5 py-1.5 text-sm disabled:opacity-40"
                onClick={handleAdd}
                disabled={!newTodoTitle.trim()}
            >
                + Add
            </button>
        </div>
    );
};

export default NewTodo;
