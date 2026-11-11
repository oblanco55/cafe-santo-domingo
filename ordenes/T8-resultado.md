# ORDEN T8 — Pantalla de resultado (perfil: desarrollador-frontend)
LEE docs/DISENO.md y src/lib/contracts/outputs.ts. Usa src/components/ui. REGLAS: breve, un archivo por llamada; solo src/components/creation y tests/e2e. Si falla 2 veces, DETENTE.
Spec: doc Carrusel §9 — guía en bloques numerados y copy en bloque separado; botones Copiar guía, Copiar copy, Crear otro; error con Reintentar sin perder respuestas.
1. src/components/creation/ResultView.tsx (client). Props: type, output, onCreateAnother(), onEdit().
   - Cabecera: title + concept; chips con plataforma y formato (aspect_ratio).
   - photo: 8 bloques numerados en tarjetas: 1 Resumen creativo, 2 Preparación, 3 Composición (subject_position, shot_type, angle, camera_height, distance como lista con etiquetas), 4 Iluminación (principal, relleno, fondo si existe, alternativa económica), 5 Fondo y ambientación, 6 Captura (lista numerada), 7 Formato y texto, 8 Verificación (checklist).
   - carousel: bloque "Estilo y configuración general" (visual_style + general_setup); luego una tarjeta por lámina "Lámina N · {purpose}" con: Encuadre, Ángulo, Luz, Fondo, Utilería, Acción, y "Texto sobre la imagen" destacado (fondo ink, comillas). Grid 1 col móvil / 2 col ≥ md.
   - video: tabla responsive de escenas (Tiempo · Plano · Acción · Narración · Texto en pantalla); en móvil, tarjetas apiladas.
   - Bloque "Supuestos y recomendaciones" si assumptions no está vacío (text-warning).
   - Bloque separado "Copy para publicar": caption + CTA + hashtags (si hay).
   - Botones: "Copiar guía" (texto plano estructurado de toda la guía, sin el copy), "Copiar copy" (caption + CTA + hashtags), ambos con navigator.clipboard y feedback "Copiado ✓" en text-success 2 s (aria-live="polite"); "Crear otro" (secundario: resetea al formulario vacío con perfil precargado) y "Editar respuestas" (vuelve al formulario con los valores).
   - Exporta también funciones puras guideToText(type, output) y copyToText(output) en src/components/creation/format.ts.
2. CreationScreen.tsx: reemplaza el <pre> por ResultView; scroll al inicio del resultado.
3. Tests: tests/unit/format.test.ts (Vitest) para guideToText/copyToText con salidas de buildMockOutput (3 modalidades; el texto de carrusel contiene "Lámina 5" para slideCount 5; copyToText no contiene secciones de la guía). E2E: ampliar crear.spec.ts → tras generar, clic "Copiar copy" muestra "Copiado"; "Crear otro" vuelve al formulario.
4. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
5. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(T8): pantalla de resultado con copiar y crear otro" && git push origin main. Informe máx. 10 líneas.
