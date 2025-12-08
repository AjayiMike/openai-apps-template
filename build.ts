import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import url from "node:url";
import { build as viteBuild, type InlineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = __dirname;
const distDir = path.join(projectRoot, "dist");
const widgetDir = path.join(projectRoot, "src", "widget");

async function ensureDir(dir: string): Promise<void> {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch {}
}

async function bundleWithVite(
    entryFile: string,
    rootId: string
): Promise<{ js: string; css: string }> {
    // Create an isolated temporary work directory outside dist/
    const tempRoot = path.join(projectRoot, ".tmp");
    await ensureDir(tempRoot);
    const workDir = path.join(
        tempRoot,
        `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    await ensureDir(workDir);
    const name = path.basename(entryFile, path.extname(entryFile));
    const entryPath = path.join(workDir, `entry-${name}.tsx`);
    const relImport = path
        .relative(path.dirname(entryPath), entryFile)
        .replace(/\\/g, "/");
    const tailwindCssAbs = path.join(projectRoot, "src", "styles", "main.css");
    const relCss = path
        .relative(path.dirname(entryPath), tailwindCssAbs)
        .replace(/\\/g, "/");
    const entryCode = `import "${relCss}";\nimport "${relImport}";\n`;
    await fs.writeFile(entryPath, entryCode, "utf8");

    const config: InlineConfig = {
        root: projectRoot,
        plugins: [react(), tailwind()],
        define: { __WIDGET_ROOT_ID__: JSON.stringify(rootId) },
        build: {
            write: false,
            cssCodeSplit: false,
            minify: true,
            target: "es2019",
            rollupOptions: { input: entryPath },
        },
    };
    const out = await viteBuild(config);
    const outputs = Array.isArray((out as any).output)
        ? (out as any).output
        : (out as any)[0].output;
    const cssAsset = outputs.find(
        (f: any) => f.type === "asset" && f.fileName.endsWith(".css")
    );
    const jsChunk = outputs.find((f: any) => f.type === "chunk" && f.isEntry);
    // Clean up the temporary work directory
    try {
        await fs.rm(workDir, { recursive: true, force: true });
    } catch {}

    return {
        css: cssAsset?.source?.toString?.() ?? "",
        js: jsChunk?.code ?? "",
    };
}

function htmlTemplate(name: string, css: string, inlinedJs: string): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${name} Widget</title>
  <style>
${css}
  </style>
</head>
<body>
  <div id="${name}-root"></div>
  <!-- Local preview data (ignored by ChatGPT Apps which populates window.openai.toolOutput) -->
  <script>
    window.todoData = window.todoData || {
      todoLists: [{
        id: "list-local",
        title: "My List",
        isCurrentlyOpen: true,
        todos: []
      }]
    };
  </script>
  <script>
${inlinedJs}
  </script>
</body>
</html>`;
}

async function discoverEntries(): Promise<
    Array<{ name: string; file: string }>
> {
    const entries: Array<{ name: string; file: string }> = [];
    if (!fsSync.existsSync(widgetDir)) return entries;
    const dirents = await fs.readdir(widgetDir, { withFileTypes: true } as any);
    for (const d of dirents) {
        if ((d as any).isDirectory()) {
            const dir = path.join(widgetDir, d.name);
            const idxJsx = path.join(dir, "index.jsx");
            const idxTsx = path.join(dir, "index.tsx");
            if (fsSync.existsSync(idxJsx)) {
                entries.push({ name: d.name, file: idxJsx });
            } else if (fsSync.existsSync(idxTsx)) {
                entries.push({ name: d.name, file: idxTsx });
            }
        } else if ((d as any).isFile()) {
            const ext = path.extname(d.name).toLowerCase();
            if (ext === ".jsx" || ext === ".tsx") {
                const base = path.basename(d.name, ext);
                entries.push({
                    name: base,
                    file: path.join(widgetDir, d.name),
                });
            }
        }
    }
    return entries;
}

async function main(): Promise<void> {
    await ensureDir(distDir);
    const entries = await discoverEntries();
    if (entries.length === 0) {
        console.warn("No widget entries found in", widgetDir);
        return;
    }
    for (const { name, file } of entries) {
        const rootId = `${name}-root`;
        const { css, js } = await bundleWithVite(file, rootId);
        const html = htmlTemplate(name, css, js);
        const outPath = path.join(distDir, `${name}.html`);
        await fs.writeFile(outPath, html, "utf8");
        console.log("Built:", path.relative(projectRoot, outPath));
    }
    // Back-compat: if the only entry is 'index', also write 'todo.html'
    if (entries.length === 1 && entries[0].name === "index") {
        const aliasSrc = path.join(distDir, "index.html");
        const aliasDst = path.join(distDir, "todo.html");
        try {
            const html = await fs.readFile(aliasSrc, "utf8");
            await fs.writeFile(aliasDst, html, "utf8");
            console.log("Alias:", path.relative(projectRoot, aliasDst));
        } catch {}
    }
    // Remove the shared temporary directory after build
    try {
        await fs.rm(path.join(projectRoot, ".tmp"), {
            recursive: true,
            force: true,
        });
    } catch {}
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
