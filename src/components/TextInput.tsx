import React, { FC } from "react";

interface TextInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder: string;
    className?: string;
    appearance?: "light" | "dark";
}

const TextInput: FC<TextInputProps> = ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    className,
    appearance = "light",
}) => {
    const themeClasses =
        appearance === "dark"
            ? "bg-[#1f1f23] border-white/20 text-white placeholder:text-white/45 focus:ring-white/30 focus:border-white/40"
            : "bg-white border-black/15 text-black placeholder:text-black/45 focus:ring-black/20 focus:border-black/30";

    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={`flex-1 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 transition-colors ${themeClasses} ${
                className ?? ""
            }`}
        />
    );
};

export default TextInput;
