// Dev loader: clickable widget list + loader (?entry=<name>).
// Each widget self-mounts into #dev-root (Vite defines __WIDGET_ROOT_ID__ = "dev-root").

const params = new URLSearchParams(location.search);
const selected = params.get("entry") || "";

// Glob all candidate widget entry files
const modules = import.meta.glob("./src/widgets/**/*.{tsx,jsx}");
import "./src/styles/main.css";

type EntryIndex = { name: string; path: string };

function buildIndex(): EntryIndex[] {
    const out: EntryIndex[] = [];
    for (const p of Object.keys(modules)) {
        const stripped = p.replace("./src/widgets/", "");
        const parts = stripped.split("/");
        let name: string;
        if (parts.length === 1) {
            name = parts[0].replace(/\.(t|j)sx$/, "");
        } else {
            name = parts[0];
        }
        if (!out.some((e) => e.name === name)) {
            out.push({ name, path: p });
        }
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
}

function renderMenu(entries: EntryIndex[], current: string) {
    const menu = document.getElementById("menu");
    if (!menu) return;
    const list = document.createElement("ul");
    list.style.listStyle = "none";
    list.style.padding = "0";
    list.style.margin = "0";
    list.style.display = "flex";
    list.style.flexWrap = "wrap";
    list.style.gap = "8px";
    for (const e of entries) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = `?entry=${encodeURIComponent(e.name)}`;
        a.textContent = e.name;
        a.style.display = "inline-block";
        a.style.padding = "6px 10px";
        a.style.borderRadius = "8px";
        a.style.border = "1px solid rgba(0,0,0,0.15)";
        a.style.textDecoration = "none";
        a.style.color = current === e.name ? "#fff" : "rgba(0,0,0,0.8)";
        a.style.background = current === e.name ? "#111" : "#fff";
        li.appendChild(a);
        list.appendChild(li);
    }
    menu.innerHTML = "";
    menu.appendChild(list);
}

function findPathByName(entries: EntryIndex[], name: string): string | null {
    const hit = entries.find((e) => e.name === name);
    return hit ? hit.path : null;
}

async function main() {
    const entries = buildIndex();
    renderMenu(entries, selected);

    if (!selected) {
        document.getElementById(
            "dev-root"
        )!.innerHTML = `<div style="color:rgba(0,0,0,0.6)">Select a widget above to render it.</div>`;
        return;
    }
    const path = findPathByName(entries, selected);
    if (!path) {
        const available = entries.map((e) => e.name).join(", ");
        document.getElementById(
            "dev-root"
        )!.innerHTML = `<div style="color:#b00">Widget "${selected}" not found.</div><div>Available: <pre>${available}</pre></div>`;
        return;
    }
    try {
        await (modules[path] as any)();
    } catch (err) {
        console.error("Failed to load widget:", err);
        document.getElementById(
            "dev-root"
        )!.innerHTML = `<div style="color:#b00">Failed to load "${selected}". Check console.</div>`;
    }
}

main();
