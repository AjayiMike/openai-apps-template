import React, { FC } from "react";

interface TextInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder: string;
    className?: string;
}

const TextInput: FC<TextInputProps> = ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    className,
}) => {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={`flex-1 border border-black/15 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 ${className}`}
        />
    );
};

export default TextInput;
