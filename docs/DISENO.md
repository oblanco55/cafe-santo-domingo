# SCRIPT 28 — Guía de diseño

Fuente: skill de diseño aportada por el usuario (2026-10-23), corregida por Claude para respetar PLAN.md, la regla de roles y WCAG AA.
**Roles:** Claude define y revisa; **Hermes implementa**. Esta guía es de obligado cumplimiento en las órdenes de UI (T6–T8). Cualquier cosa no cubierta aquí ni en PLAN.md/IDEA.md se consulta antes de asumirla.

## 1. Paleta oficial

| Token | Hex | Uso |
|---|---|---|
| `brand-orange` | `#FC762F` | Inicio del degradado, foco, estado seleccionado |
| `brand-coral` | `#FC4F37` | Centro del degradado |
| `brand-fuchsia` | `#F81151` | Final del degradado |
| `ink` | `#070B14` | Fondo de la app (`body`) y **texto sobre el degradado** |
| `night` | `#0E1830` | Tarjetas, inputs, paneles |
| `white` | `#FFFFFF` | Texto principal |
| `mist` | `#D9DCE3` | Texto secundario; bordes con opacidad baja (`/15`–`/20`) |
| `muted` | `#9AA3B5` | Ayudas, placeholders, metadatos (contraste 6.9:1 sobre `night`) |

Colores de estado (no existen en la skill original; añadidos para no usar los de Tailwind por defecto):

| Token | Hex | Uso | Contraste sobre `night` |
|---|---|---|---|
| `danger` | `#FF8FA3` | Errores de campo y mensajes de error | 8.2:1 |
| `success` | `#4ADE80` | Confirmaciones ("Copiado") | 10.1:1 |
| `warning` | `#FBBF24` | Avisos (texto provisional, modo demo) | 10.6:1 |

**Prohibido** usar colores por defecto de Tailwind (`gray-*`, `neutral-*`, `blue-*`, etc.). Solo estos tokens.

## 2. Implementación técnica (Tailwind v4)

El proyecto usa **Tailwind v4**: NO existe `tailwind.config.ts`. Los tokens se declaran en `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand-orange: #FC762F;
  --color-brand-coral: #FC4F37;
  --color-brand-fuchsia: #F81151;
  --color-ink: #070B14;
  --color-night: #0E1830;
  --color-mist: #D9DCE3;
  --color-muted: #9AA3B5;
  --color-danger: #FF8FA3;
  --color-success: #4ADE80;
  --color-warning: #FBBF24;
  --font-sans: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
}

body { background: var(--color-ink); color: #fff; }
```

Se eliminan las variables `--background/--foreground` y el bloque `prefers-color-scheme` de la plantilla (la app es solo oscura).
Clase del degradado: `bg-gradient-to-r from-brand-orange via-brand-coral to-brand-fuchsia`.

## 3. Tipografía
- **Plus Jakarta Sans** vía `next/font/google` (variable `--font-jakarta`), pesos 400/500/600/700/800. Reemplaza a Geist.
- Titular landing: 800, `text-4xl` móvil → `text-6xl` escritorio, `tracking-tight`. "gran guion." con el degradado como texto (`bg-clip-text text-transparent`).
- `<html lang="es">`. Metadata: title "Script 28 — De ideas a contenido", description en español.

## 4. Componentes

**Botón primario** (Comenzar ahora, Crear mi primer guion, Generar guía, Crear cuenta):
- Fondo: degradado principal. **Texto `ink` (#070B14), font-semibold.**
  - Motivo (WCAG AA, medido): blanco sobre el degradado da 2.70 / 3.33 / 4.05 — **no cumple** 4.5:1. `ink` da 7.28 / 5.92 / 4.86 — cumple en todo el degradado.
- `rounded-xl`, `px-5 py-3`, `hover:brightness-110`, `disabled:opacity-50 disabled:cursor-not-allowed`, estado de carga con texto "Procesando…".

**Botón secundario:** fondo transparente, borde `mist/20`, texto blanco, `hover:bg-night`.

**Tarjeta:** `bg-night`, `border border-mist/15`, `rounded-2xl`, `p-5`/`p-6`.

**Input / select / textarea:** `bg-ink` (dentro de tarjeta `night`), borde `mist/20`, texto blanco, placeholder `muted`, `rounded-xl`. Foco: `outline-none ring-2 ring-brand-orange`. Error: borde `danger` + mensaje `text-danger text-sm` debajo, con `aria-invalid` y `aria-describedby`.

**Selección (Producto/Servicio, plataforma, formato, nº láminas):** botones tipo segmento `bg-night` borde `mist/15`; seleccionado: `border-brand-orange` + texto blanco + `aria-pressed="true"`.

**Tarjetas de modalidad del panel (Video / Fotografía / Carrusel):** `bg-night`, icono en cuadro 40×40 con fondo degradado e icono en `ink`; hover: `border-brand-orange`.
- Iconos SVG inline (no letras): video = botón play en rectángulo; fotografía = cámara; carrusel = láminas apiladas. Sin dependencia nueva salvo aprobación (lucide-react permitido si Claude lo aprueba en la orden).
- Textos: "Guion de video — Guion por escenas + copy adaptado a la plataforma"; "Fotografía — Guía para una sola imagen (cuadrada o vertical)"; "Carrusel — Guía fotográfica por lámina + copy". Usar **"lámina"**, nunca "slide".

**Foco visible** en todos los elementos interactivos (`focus-visible:ring-2 ring-brand-orange`). Objetivos táctiles ≥ 44 px.

## 5. Logo e iconos
Archivos oficiales (entregados por el usuario 2026-10-23; versiones transparentes generadas por Claude):
- `public/brand/logo-script28.png` — logo completo, fondo transparente, 1454×354. **Usar este** en cabecera, landing y auth con `next/image` (`alt="Script 28"`, `priority` en la landing).
- `public/brand/logo-script28@120h.png` — 120 px de alto, para cabeceras.
- `public/brand/logo-script28-original.png` — original con fondo negro (solo referencia; no usar sobre la app).
- `public/brand/icon-28.png` — "28" sobre `ink`, 512×512.
- `src/app/icon.png` (512) y `src/app/apple-icon.png` (180) — favicon/ícono iOS automáticos de Next. Se eliminó `favicon.ico` de la plantilla.
- Tamaños: cabecera 28–32 px de alto en móvil, 36–40 px en escritorio; landing hero hasta 64 px. No deformar, no recolorear, no añadir sombras.
- El logo de texto "SCRIPT **28**" hecho con CSS se reemplaza por la imagen.

## 6. Layout
- Móvil primero; gutter 16 px; contenedor `max-w-md` en formularios, `max-w-5xl` en panel/resultado. Sin scroll horizontal a 375 px.
- Cabecera: logo "SCRIPT **28**" (28 con degradado) + acción de sesión (Iniciar sesión / Cerrar sesión).

## 7. Fuera de alcance (no implementar)
Sidebar con "Mis proyectos", "Plantillas", "Inspiración", "Marca"; página de Precios; buscador; vista previa lateral en vivo. Aparecen en la imagen de referencia pero quedaron fuera (PLAN.md D6). Proponer en una fase posterior si se desean.

## 8. Restricciones (heredadas)
- Carrusel: exactamente 3, 5 o 7 láminas. Fotografía: solo 1:1 y 9:16.
- No inventar datos comerciales ni textos legales (términos/privacidad siguen provisionales y marcados con `warning`).
- No ocultar errores; las pruebas fallidas se reportan con su log.
- Hermes: órdenes cortas, `--reasoning none`, un archivo por llamada, detenerse tras 2 fallos.
