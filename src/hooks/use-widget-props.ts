import { useOpenAiGlobal } from "./use-openai-global";

/**
 * Hook to get widget props (tool output) from ChatGPT.
 *
 * @param defaultState - Default value or function to compute it if tool output is not available
 * @returns The tool output props or the default fallback
 *
 * @example
 * ```tsx
 * const props = useWidgetProps({ userId: "123", name: "John" });
 * ```
 */
export function useWidgetProps<T extends Record<string, unknown>>(
    defaultState?: T | (() => T | null) | null
): T | null {
    const props = useOpenAiGlobal("toolOutput") as T | null;

    const fallback =
        typeof defaultState === "function"
            ? (defaultState as () => T | null)()
            : defaultState ?? null;

    return props ?? fallback;
}
