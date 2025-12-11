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
const widgetsDir = path.join(projectRoot, "src", "widgets");
const INLINE_ASSETS = process.env.CHATGPT_SINGLE === "1";

async function ensureDir(dir: string): Promise<void> {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch {}
}

type BundledAsset = { fileName: string; source: string | Uint8Array };

function assetSourceToString(source?: string | Uint8Array): string {
    if (source === undefined) return "";
    return typeof source === "string"
        ? source
        : Buffer.from(source).toString("utf8");
}

async function bundleWithVite(
    entryFile: string,
    rootId: string
): Promise<{
    js: string;
    css: string;
    assets: BundledAsset[];
}> {
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
        base: "./",
        plugins: [react(), tailwind()],
        define: { __WIDGET_ROOT_ID__: JSON.stringify(rootId) },
        build: {
            write: false,
            cssCodeSplit: false,
            minify: true,
            target: "es2019",
            rollupOptions: { input: entryPath },
            assetsInlineLimit: INLINE_ASSETS
                ? Number.MAX_SAFE_INTEGER
                : undefined,
        },
    };
    const out = await viteBuild(config);
    const outputs = Array.isArray((out as any).output)
        ? (out as any).output
        : (out as any)[0].output;
    const assetOutputs = outputs.filter((f: any) => f.type === "asset");
    const cssAssets = assetOutputs.filter(
        (f: any) =>
            typeof f.fileName === "string" && f.fileName.endsWith(".css")
    );
    const otherAssets = assetOutputs.filter((f: any) => !cssAssets.includes(f));
    const jsChunk = outputs.find((f: any) => f.type === "chunk" && f.isEntry);
    // Clean up the temporary work directory
    try {
        await fs.rm(workDir, { recursive: true, force: true });
    } catch {}

    return {
        css: cssAssets
            .map((asset: any) => assetSourceToString(asset.source))
            .join("\n"),
        js: jsChunk?.code ?? "",
        assets: otherAssets.map((asset: any) => ({
            fileName: asset.fileName,
            source:
                typeof asset.source === "string" ||
                asset.source instanceof Uint8Array
                    ? asset.source
                    : "",
        })),
    };
}

function htmlTemplate(name: string, css: string, inlineJs: string): string {
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
  <!-- Local preview hint data for flying pig stats -->
  <script>
    window.flyingPigData = window.flyingPigData || {
      stats: {
        totalGamesStarted: 3,
        totalScoreSubmissions: 1,
        lastScore: null,
        highScores: [{
          id: "local-ace",
          playerName: "Ace Pilot",
          score: 42,
          recordedAt: new Date().toISOString()
        }]
      },
      tips: [
        "Hold space, click, or tap to keep altitude.",
        "Stars unlock a super-speed burst—collect five.",
        "Carrots shave some weight when things get dicey."
      ]
    };
  </script>
  <script type="module">
${inlineJs}
  </script>
</body>
</html>`;
}

async function discoverEntries(): Promise<
    Array<{ name: string; file: string }>
> {
    const entries: Array<{ name: string; file: string }> = [];
    if (!fsSync.existsSync(widgetsDir)) return entries;
    const dirents = (await fs.readdir(widgetsDir, {
        withFileTypes: true,
    } as any)) as unknown as fsSync.Dirent[];
    for (const d of dirents) {
        if ((d as any).isDirectory()) {
            const dir = path.join(widgetsDir, d.name);
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
                    file: path.join(widgetsDir, d.name),
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
        console.warn("No widget entries found in", widgetsDir);
        return;
    }
    for (const { name, file } of entries) {
        const rootId = `${name}-root`;
        const { css, js, assets } = await bundleWithVite(file, rootId);
        const html = htmlTemplate(name, css, js);
        const outPath = path.join(distDir, `${name}.html`);
        await fs.writeFile(outPath, html, "utf8");
        for (const asset of assets) {
            const flattenedName = path.basename(asset.fileName);
            const assetPath = path.join(distDir, flattenedName);
            await ensureDir(path.dirname(assetPath));
            await fs.writeFile(assetPath, asset.source);
        }
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
