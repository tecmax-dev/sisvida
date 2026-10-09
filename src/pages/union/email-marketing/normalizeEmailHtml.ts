// Limpa conteúdo colado (Word, Excel, sites) para caber bem no e-mail:
// remove margens/larguras fixas, ajusta tabelas e transforma texto com tabulação em tabela.
const TABLE_STYLE = "width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;";
const CELL_STYLE = "border:1px solid #e2e8f0;padding:6px 10px;text-align:left;vertical-align:top;";

function tabsToTable(lines: string[]): string {
  const rows = lines.map((l) => l.split("\t"));
  const cols = Math.max(...rows.map((r) => r.length));
  const html = rows
    .map((r, i) => {
      const tag = i === 0 ? "th" : "td";
      const bg = i === 0 ? "background:#f1f5f9;font-weight:600;" : "";
      const cells = Array.from({ length: cols }, (_, k) => `<${tag} style="${CELL_STYLE}${bg}">${(r[k] ?? "").trim()}</${tag}>`);
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");
  return `<table style="${TABLE_STYLE}">${html}</table>`;
}

export function normalizeEmailHtml(html: string): string {
  if (typeof window === "undefined" || !html) return html;
  const isFullDoc = /<body[\s>]/i.test(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.body;

  // Remove lixo do Word/Office
  root.querySelectorAll("o\\:p, xml, style, meta, script").forEach((n) => n.remove());
  root.innerHTML = root.innerHTML.replace(/<!--\[if[\s\S]*?endif\]-->/gi, "");

  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.removeAttribute("class");
    el.removeAttribute("width");
    el.removeAttribute("height");
    const s = el.style;
    if (s) {
      ["margin-left", "margin-right", "text-indent", "position", "left", "top", "float"].forEach((p) => s.removeProperty(p));
      const w = s.getPropertyValue("width");
      if (w && !w.endsWith("%") && el.tagName !== "IMG") s.removeProperty("width");
      if (w && parseFloat(w) > 600) s.setProperty("width", "100%");
      s.removeProperty("min-width");
      if (el.tagName === "IMG") {
        s.setProperty("max-width", "100%");
        s.setProperty("height", "auto");
      }
      if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
    }
  });

  // Ajusta tabelas coladas
  root.querySelectorAll("table").forEach((t) => {
    t.setAttribute("style", TABLE_STYLE);
    t.querySelectorAll("td, th").forEach((c) => {
      const prev = (c.getAttribute("style") || "").replace(/(border|padding)[^;]*;?/gi, "");
      c.setAttribute("style", CELL_STYLE + prev);
    });
  });

  // Auto tabular: parágrafos seguidos contendo tabulação viram tabela
  const blocks = Array.from(root.querySelectorAll("p, div")).filter((b) => b.children.length === 0 || b.querySelector("br"));
  let group: Element[] = [];
  const flush = () => {
    if (group.length >= 1) {
      const lines = group.flatMap((g) => (g as HTMLElement).innerText ?? g.textContent ?? "").flatMap((t) => t.split(/\n/)).filter((l) => l.includes("\t"));
      if (lines.length) {
        const wrap = doc.createElement("div");
        wrap.innerHTML = tabsToTable(lines);
        group[0].replaceWith(wrap.firstChild as Node);
        group.slice(1).forEach((g) => g.remove());
      }
    }
    group = [];
  };
  blocks.forEach((b) => {
    if ((b.textContent || "").includes("\t")) {
      if (group.length && group[group.length - 1].nextElementSibling !== b) flush();
      group.push(b);
    } else flush();
  });
  flush();

  // Remove parágrafos vazios repetidos
  root.innerHTML = root.innerHTML.replace(/(<p>(\s|&nbsp;|<br>)*<\/p>\s*){2,}/gi, "<p><br></p>");

  return isFullDoc ? "<!DOCTYPE html>\n" + doc.documentElement.outerHTML : root.innerHTML;
}
