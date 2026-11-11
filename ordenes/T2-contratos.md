# ORDEN T2 — Contratos y esquemas zod (perfil: arquitecto)
Ordena: Claude (cerebro). Ejecuta: Hermes. Lee PLAN.md, IDEA.md y las dos especificaciones (usa `textutil -convert txt -stdout <archivo>.docx` para leerlas).
NOTA: zod instalado es v4 (API v4: z.email(), error en lugar de message/errorMap, etc.). Sé conciso: usa herramientas, informe final máx. 30 líneas.
Directorio: /Users/omar/Desktop/Claude/Script 28. No toques auth, UI ni IA (otras tareas). No borres archivos existentes.

Crea src/lib/contracts/ con código TypeScript + zod, sin lógica de negocio:

1. catalogs.ts — constantes `as const` y tipos:
   - PLATFORMS: instagram, facebook, tiktok, youtube (con etiqueta en español).
   - OFFER_TYPES: product ("Producto"), service ("Servicio").
   - SECTORS (lista unificada D4 de PLAN.md): moda, gastronomia, belleza, salud, educacion, tecnologia, servicios_profesionales, legal, turismo, inmobiliaria, automotriz, hogar, otro — con etiquetas con tildes.
   - OBJECTIVES: presentacion, beneficio, promocion, confianza, educativo, otro (default presentacion).
   - EQUIPMENT: celular, camara, no_se.
   - RESOURCES: luz_natural, lampara, aro_de_luz, fondo_liso, escritorio, modelo_persona, ninguno.
   - PHOTO_STYLES: producto_solo, producto_en_uso, persona_servicio, espacio_instalacion, ia_recomienda.
   - CAROUSEL_STRUCTURES: presentacion, beneficios, paso_a_paso, problema_solucion, ia_recomienda.
   - ASPECT_RATIOS: "1:1" (1080×1080, "Cuadrada"), "9:16" (1080×1920, "Vertical Story"). SOLO estos dos.
   - SLIDE_COUNTS: 3,5,7. VIDEO_DURATIONS: 15,30,45.
   - COUNTRIES: lista de países hispanohablantes + resto principales con código ISO-3166 alfa-2 y nombre en español (mínimo los 21 hispanohablantes + US, CA, BR, PT, FR, IT, DE, GB; ordenados alfabéticamente).

2. inputs.ts — esquemas de entrada:
   - commonInputSchema: countryIso (de COUNTRIES, obligatorio), offerType (obligatorio), sector (obligatorio), sectorOther (obligatorio solo si sector==="otro", 2–80 chars, usar superRefine), description (obligatoria, trim, 20–1500 chars), platform (obligatorio), objective (opcional, default presentacion), equipment (opcional), resources (array opcional, sin duplicados; "ninguno" excluye a los demás).
   - videoInputSchema = común + duration.
   - photoInputSchema = común + aspectRatio (obligatorio) + photoStyle (opcional, default ia_recomienda).
   - carouselInputSchema = común + slideCount (obligatorio) + carouselStructure (opcional, default ia_recomienda) + aspectRatio (obligatorio).
   - Mensajes de error en español, claros para el usuario.

3. outputs.ts — esquemas de salida (lo que devuelve la IA, ver doc Carrusel §8 y doc Estática §6):
   - base: title, concept, platform, aspect_ratio, visual_style, caption, cta, hashtags (array de strings ≤ 10, puede ser vacío), assumptions (array de strings: supuestos/recomendaciones condicionales).
   - photoOutputSchema: base + sections: { creative_summary, preparation, composition, lighting, background, capture_steps (array numerable de strings ≥3), format_and_text, verification (array ≥3) } — cada sección de texto no vacía. Composition debe incluir campos: subject_position, shot_type, angle, camera_height, distance. Lighting: main_light, fill_light, background_light (opcional), budget_alternative.
   - slideSchema: index, purpose (función narrativa), framing, angle, lighting, background, props, actions, overlay_text.
   - carouselOutputSchema: base + general_setup (iluminación y color comunes) + slides: array de slideSchema. Exporta helper `carouselOutputFor(slideCount)` que exige slides.length === slideCount y índices 1..n consecutivos.
   - sceneSchema: index, time_range ("0–3 s"), shot, action, narration, on_screen_text.
   - videoOutputSchema: base + scenes (≥3), con helper que valide que el último time_range termina en la duración elegida.

4. api.ts — tipos de la API: CreationType ("video"|"photo"|"carousel"), CreateCreationRequest por tipo, CreateCreationResponse { id, type, output } y ApiError { error: { code: "VALIDATION"|"UNAUTHORIZED"|"AI_FAILED"|"RATE_LIMIT"|"INTERNAL", message, fieldErrors? } }.

5. index.ts que reexporta todo.

6. Tests Vitest en tests/contracts/*.test.ts: casos válidos e inválidos para cada esquema (sectorOther requerido con "otro", aspectRatio 4:5 rechazado, slideCount 4 rechazado, carrusel con 4 láminas cuando se pidieron 5 rechazado, "ninguno" combinado rechazado, descripción corta rechazada, salida de foto incompleta rechazada).

Verificación obligatoria (reporta salida real): npm run lint, npx tsc --noEmit, npm test.
Commit "feat(T2): contratos zod de entrada/salida y catálogos" y git push origin main.
Informe: archivos creados, resultados de verificación, dudas detectadas en los documentos. No ocultes fallos.
