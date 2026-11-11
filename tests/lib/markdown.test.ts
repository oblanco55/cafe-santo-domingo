/**
 * F2-5 — Helper de renderizado Markdown seguro (src/lib/markdown.ts).
 *
 * Verifica:
 * 1. Parsing Markdown → HTML (títulos, negrita, listas, enlaces, código).
 * 2. Sanitización: <script>, event handlers (onclick/onerror) y iframes
 *    son eliminados; el resto del contenido sobrevive.
 * 3. Caracteres de formato es-ES (tilde, ñ) se conservan.
 */
import { describe, it, expect } from "vitest";
import { renderMarkdownSafe } from "@/lib/markdown";

describe("renderMarkdownSafe", () => {
  it("convierte Markdown básico a HTML", () => {
    const html = renderMarkdownSafe("# Título\n\nHola **mundo**.\n\n- item 1\n- item 2");
    expect(html).toContain("<h1>Título</h1>");
    expect(html).toContain("<strong>mundo</strong>");
    expect(html).toContain("<li>item 1</li>");
  });

  it("preserva enlaces normales", () => {
    const html = renderMarkdownSafe("Visita [ejemplo](https://example.com)");
    expect(html).toContain('<a href="https://example.com">');
  });

  it("elimina <script> inyectado en el Markdown", () => {
    const html = renderMarkdownSafe("Antes <script>alert(1)</script> después");
    expect(html).not.toContain("<script");
    expect(html).toContain("Antes");
  });

  it("elimina event handlers (onclick, onerror) en HTML inline", () => {
    const html = renderMarkdownSafe('<img src="x" onerror="alert(1)" /><img src="y" />');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain('onclick="');
  });

  it("elimina iframes y objetos incrustados", () => {
    const html = renderMarkdownSafe('<iframe src="https://evil.example"></iframe>texto');
    expect(html).not.toContain("<iframe");
    expect(html).toContain("texto");
  });

  it("preserva contenido legible junto a un script eliminado", () => {
    const html = renderMarkdownSafe("Inicio <script>bad()</script> fin");
    expect(html).not.toContain("bad()");
    expect(html).toMatch(/Inicio/);
  });

  it("conserva caracteres es-ES (tilde, ñ, acentos)", () => {
    const html = renderMarkdownSafe("> Confidencial: **secreto**");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("secreto");
    // marcado con acento no debe romperse
    const html2 = renderMarkdownSafe("# Ñandú y ñoño");
    expect(html2).toContain("Ñandú");
  });

  it("manejable cadena vacía", () => {
    expect(renderMarkdownSafe("")).toBe("");
  });
});
