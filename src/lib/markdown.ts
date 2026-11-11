import { marked } from "marked";
import DOMPurify, { type Config } from "dompurify";

const sanitizeConfig: Config = {
  FORBID_TAGS: ["script", "iframe", "object", "embed", "style", "link", "form", "input", "button"],
  FORBID_ATTR: [
    "onerror", "onload", "onclick", "onmouseover", "onmouseup", "onmousedown",
    "onfocus", "onblur", "onchange", "oninput", "onsubmit",
  ],
  ADD_ATTR: ["target", "rel"],
};

/**
 * Convierte Markdown a HTML sanitizado (seguro para insertar en el DOM).
 *
 * Pipeline:
 *   1. marked → parsing Markdown a HTML bruto.
 *   2. DOMPurify (con ventana jsdom) → sanitización: elimina <script>,
 *      event handlers, iframes y demás contenido peligroso.
 *
 * Nota: es un helper SERVER (importa jsdom). Úsalo en Server Components
 * o Route Handlers, nunca en Client Components.
 */
export function renderMarkdownSafe(md: string): string {
  const raw = marked.parse(md) as string;
  const clean = _getPurify().sanitize(raw, sanitizeConfig);
  return typeof clean === "string" ? clean : "";
}

// Cache del sanitizer (una instancia jsdom por proceso es suficiente).
let _purify: ReturnType<typeof DOMPurify> | null = null;

function _getPurify(): ReturnType<typeof DOMPurify> {
  if (_purify) return _purify;
  // jsdom: carga síncrona perezosa (solo la primera vez por proceso).
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { JSDOM } = require("jsdom") as {
    JSDOM: new (html: string) => { window: unknown };
  };
  const jsdom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  _purify = DOMPurify(jsdom.window as never);
  return _purify;
}
