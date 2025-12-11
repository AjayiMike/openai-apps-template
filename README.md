## OpenAI Apps Template (Todo App)

Build, preview, and ship a ChatGPT App that renders a responsive React widget and talks to a Model Context Protocol (MCP) server—all from one repository.

-   **Single-file widget delivery** – every widget is bundled into `dist/<name>.html` with inline JS + CSS so ChatGPT can embed it via `ui://widget/...`.
-   **Batteries-included MCP server** – exposes SSE + POST endpoints, advertises tools/resources, and returns structured todo data plus widget metadata.
-   **Local-first DX** – Vite dev server with HMR, Tailwind styles, React 19, TypeScript, and helper hooks that mirror the ChatGPT `window.openai` runtime.

> Use this template as a starting point for any small app that needs both an interactive UI and tools the ChatGPT agent can call.

---

### At a Glance

| Piece                  | Tech                               | Purpose                                                                                                    |
| ---------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/widgets/todo.tsx` | React + hooks                      | Interactive todo widget that can optimistically update local state while syncing with the agent            |
| `server.ts`            | Node + `@modelcontextprotocol/sdk` | Minimal MCP server exposing `todo list`, `add_todo`, `toggle_todo`, `delete_todo`, and the widget resource |
| `build.ts`             | Vite + esbuild                     | Discovers widget entries, bundles them, and emits inline HTML files ready for `ui://widget/...`            |
| `dev.ts`               | Vite loader                        | Lets you hot-reload any widget via `http://localhost:5173?entry=<name>`                                    |

---

## Prerequisites

-   Node.js **18+**
-   npm (or pnpm/yarn if you adapt the scripts)
-   (Optional) [ngrok](https://ngrok.com/) or similar tunnel to share the MCP server with ChatGPT

Install dependencies:

```bash
npm install
```

---

## Quick Start

1. **Build the widget bundle**

    ```bash
    npm run build
    # → dist/todo.html (inline CSS + JS)
    ```

2. **Run the MCP server**

    ```bash
    npm start
    # SSE  GET  http://localhost:8000/mcp
    # POST POST http://localhost:8000/mcp/messages?sessionId=...
    ```

3. **Preview the widget locally (optional)**

    ```bash
    npm run dev
    # open http://localhost:5173?entry=todo
    ```

4. **Expose to ChatGPT (optional)**

    ```bash
    ngrok http 8000
    # use https://<subdomain>.ngrok-free.app/mcp as the connector URL
    ```

---

## Development Workflow

### Widget iteration

-   Widgets live under `src/widgets/<name>.tsx`. Each file should call `createRoot` and mount itself into `__WIDGET_ROOT_ID__`.
-   `npm run dev` spins up Vite with HMR. Navigate to `http://localhost:5173?entry=<name>` to load that widget.
-   Hooks under `src/hooks` provide typed access to `window.openai` globals:
    -   `useWidgetProps` pulls structured tool output (`toolOutput.todoLists` in this case).
    -   `useWidgetState` keeps local widget state in sync with the ChatGPT host via `window.openai.setWidgetState`.
    -   `useCallTool`, `useRequestDisplayMode`, etc. wrap MCP APIs.

### Building for ChatGPT

-   `npm run build` auto-discovers every file in `src/widgets` (or nested `index.tsx` files inside directories) and emits `dist/<name>.html`.
-   Each HTML file inlines:
    1. Shared Tailwind styles from `src/styles/main.css`
    2. A fallback `window.todoData` block for standalone preview
    3. The minified widget bundle
-   The build script keeps the output self-contained so ChatGPT can fetch `ui://widget/<name>.html` with no extra assets.

### MCP server

-   `server.ts` wires up `@modelcontextprotocol/sdk` with an `SSEServerTransport`:
    -   `GET /mcp` starts the SSE session.
    -   `POST /mcp/messages?sessionId=<id>` streams tool messages/responses.
-   Tools shipped by default:
    | Name | Description | Arguments |
    | --- | --- | --- |
    | `todo-list` | Return current todo lists | none |
    | `add_todo` | Insert a new todo | `{ listId?, title }` |
    | `toggle_todo` | Flip completion state | `{ listId, todoId }` |
    | `delete_todo` | Remove a todo | `{ listId, todoId }` |
-   All tool responses include:
    -   `structuredContent.todoLists` (mirrors the widget data contract)
    -   `_meta.openai/*` descriptors so ChatGPT knows to render the widget
-   The server keeps a simple in-memory `globalTodoState`. Swap this out for a real database or API when you graduate from the demo.

---

## Connecting to ChatGPT Apps

1. Enable **Developer Mode** in ChatGPT → Settings → _Connectors_.
2. Create a new “Model Context Protocol” connector.
3. Point the MCP URL at your server (local tunnel or deployed host):

    ```
    https://<your-ngrok-subdomain>.ngrok-free.app/mcp
    ```

4. In a ChatGPT conversation, ask something like “Show my todo list” or “Add ‘Review PR’ to my todos.” ChatGPT will call the appropriate tool(s), and the widget will render using the `ui://` resource the server exposes.

---

## Project Structure

```
openai-apps-template/
├─ src/
│  ├─ widgets/
│  │  └─ todo.tsx         # React widget (self-mounting)
│  ├─ components/
│  │  └─ TodoItem.tsx     # Presentational list item
│  ├─ hooks/              # window.openai + MCP helpers
│  ├─ styles/main.css     # Tailwind layer shared by widgets
│  └─ utils/              # UI utilities (media queries, etc.)
├─ build.ts               # Inline widget bundler
├─ dev.ts                 # Vite preview loader (?entry=<name>)
├─ server.ts              # MCP SSE server + todo tools
├─ dist/                  # Generated ui:// HTML widgets
├─ package.json
└─ README.md
```

---

## Scripts & Configuration

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `npm run build`     | Bundle every widget into `dist/*.html`      |
| `npm start`         | Launch MCP server (defaults to port `8000`) |
| `npm run start:all` | Build widgets, then start the server        |
| `npm run dev`       | Vite dev server for widget HMR preview      |

Environment variables:

-   `PORT` – overrides the MCP server port (default `8000`).

---

## Extending the Template

-   **Add another widget**: drop `src/widgets/notes.tsx`, ensure it mounts to `__WIDGET_ROOT_ID__`, run `npm run build`, then expose it as a new resource/tool in `server.ts`.
-   **Persist todo data**: replace `globalTodoState` with a database call or REST client. The only contract the widget needs is `{ todoLists: TodoList[] }`.
-   **Enhance UI state**: use `useWidgetState` for optimistic updates; it already mirrors state back to ChatGPT so the host stays in sync between agent turns.
-   **Add more tools**: register descriptors in `server.ts` (`ListToolsRequestSchema` handler) and implement the behavior inside the `CallToolRequest` handler.

---

## Troubleshooting

-   **Widget shows stale data** – ensure the MCP response includes fresh `structuredContent.todoLists` and `_meta.openai/outputTemplate`. The widget only resyncs when the host sends new structured data.
-   **“Build not found” error** – run `npm run build` before starting `npm start` so `dist/todo.html` exists.
-   **No widget in ChatGPT** – verify the connector is allowed to render widgets (`openai/widgetAccessible: true`) and that the `ui://widget/<name>.html` resource is listed via `ListResources`.
-   **CORS or tunnel issues** – the server enables `Access-Control-Allow-Origin: *`, but your tunnel must forward both `GET /mcp` and `POST /mcp/messages`.

---

Happy shipping! Open issues or PRs if you add new widgets, storage adapters, or deployment recipes.
