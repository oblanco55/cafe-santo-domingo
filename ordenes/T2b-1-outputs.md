# ORDEN T2b-1 (perfil: arquitecto) — Contexto: ordenes/T2-contratos.md punto 3.
YA EXISTEN y son correctos: src/lib/contracts/catalogs.ts e inputs.ts (no los reescribas, salvo el ajuste 0).
Sé breve. Escribe un archivo por llamada de herramienta. No pegues el código en tu respuesta final.
0. En inputs.ts: duration y slideCount deben aceptar NÚMEROS (z.union de z.literal(15|30|45) y z.literal(3|5|7)), no strings. Ajusta solo eso.
1. Crea src/lib/contracts/outputs.ts según T2-contratos.md punto 3 (zod v4): baseOutput, photoOutputSchema, slideSchema, carouselOutputSchema + carouselOutputFor(n), sceneSchema, videoOutputSchema + videoOutputFor(duration). Mantenlo compacto (< 200 líneas).
2. Ejecuta npx tsc --noEmit y corrige errores.
Informe final: 5 líneas máximo.
