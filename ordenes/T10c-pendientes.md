# ORDEN T10c — 3 pendientes de T10 (perfil: desarrollador-frontend). Breve; informe máx. 6 líneas. Si falla 2 veces, DETENTE.
HECHOS VERIFICADOS POR CLAUDE con grep (tu informe T10b decía que estaban hechos, pero NO lo están):
1. src/lib/ai/mock.ts línea ~59: `title: \`Guía de ${TYPE_LABEL[type]}: …\`` → para video debe ser "Guion de video: …" (foto: "Guía de fotografía: …", carrusel: "Guía de carrusel: …").
2. src/lib/ai/mock.ts líneas ~95-102: creative_summary dice "con estilo ${style}" con el código crudo (ia_recomienda). Usa la etiqueta de PHOTO_STYLES y omite la frase del estilo cuando sea ia_recomienda.
3. src/app/crear/[type]/page.tsx línea ~68: cambia `pt-24` → `pt-8` y `sm:pt-28` → `sm:pt-10`.
4. Comprueba que el chip de formato del resultado muestra "Cuadrada 1:1" / "Vertical Story 9:16" (función aspectLabel en ResultView.tsx); si no incluye la proporción, añádela.
Verifica con grep que los 4 puntos quedaron, luego: npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
OBLIGATORIO: git add -A (sin .env) && git commit -m "fix(T10c): títulos, estilo y espaciado pendientes" && git push origin main.
