import { useOpenAiGlobal } from "./use-openai-global";

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
