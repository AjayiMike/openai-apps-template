import { useSyncExternalStore } from "react";

export function useIsChatGptApp(): boolean {
    return useSyncExternalStore(
        () => {
            // No subscription needed for this static value
            return () => {};
        },
        () => {
            if (typeof window === "undefined") return false;
            return (window as any).__isChatGptApp ?? false;
        },
        () => {
            return false;
        }
    );
}
