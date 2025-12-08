import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react() as PluginOption, tailwind() as unknown as PluginOption],
    define: {
        __WIDGET_ROOT_ID__: JSON.stringify("dev-root"),
    },
    server: {
        port: 5173,
    },
});
