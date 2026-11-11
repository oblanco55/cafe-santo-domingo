# ORDEN T7 — Formularios contextuales (perfil: desarrollador-frontend)
LEE docs/DISENO.md y los contratos src/lib/contracts (catalogs.ts, inputs.ts). Usa src/components/ui. REGLAS: breve, un archivo por llamada; no toques src/app/api ni src/lib. Si falla 2 veces, DETENTE.
Especificación: Script28_Modulo_Fotografia_Estatica.docx §4 y Script28_Modulo_Fotografia_Carrusel.docx §4 (léelos con textutil -convert txt -stdout <archivo>).
1. src/components/creation/CreationForm.tsx (client). Props: type 'video'|'photo'|'carousel', initialProfile (BusinessProfile|null), onSubmit(values) y estado submitting.
   Campos comunes, en este orden y con estas etiquetas:
   1 "¿En qué país resides?" Select COUNTRIES (obligatorio, precargado de initialProfile).
   2 "¿Qué deseas promocionar?" Segmented Producto/Servicio (obligatorio).
   3 "¿A qué sector pertenece?" Select SECTORS; si "otro" → Input "Especifica tu sector" (obligatorio en ese caso).
   4 Etiqueta dinámica: "Háblanos un poco de tu producto" / "…de tu servicio" (según offerType). Textarea obligatoria, contador de caracteres (20–1500), ayuda: "Qué ofreces, qué lo hace especial, qué quieres destacar. Ej.: …" con un ejemplo distinto para producto y servicio.
   5 "¿Para qué plataforma es la publicación?" Segmented Instagram/Facebook/TikTok/YouTube.
   Opcionales (sección plegable "Más detalles (opcional)"): "¿Qué deseas destacar?" (OBJECTIVES, default presentación), "¿Con qué vas a tomar las fotos?" (EQUIPMENT; para video: "¿Con qué vas a grabar?"), "¿Qué recursos tienes disponibles?" (RESOURCES, multiselección con checkboxes; "Ninguno" desmarca los demás).
   Específicos:
   - video: "¿Cuánto debe durar?" Segmented 15 s / 30 s / 45 s (obligatorio).
   - photo: "¿Qué formato necesitas?" Segmented "Cuadrada 1:1 (1080×1080)" / "Vertical Story 9:16 (1080×1920)" (obligatorio); "¿Qué tipo de fotografía quieres?" PHOTO_STYLES (opcional).
   - carousel: "¿Cuántas láminas deseas?" Segmented 3/5/7 (obligatorio); "¿Qué estructura prefieres?" CAROUSEL_STRUCTURES (opcional); formato Segmented 1:1 / 9:16 (obligatorio).
   Validación en cliente con el esquema zod de la modalidad (safeParse en cada cambio); errores por campo; botón primario ("Generar guion" / "Generar guía fotográfica" / "Generar guía de carrusel") DESHABILITADO hasta que el esquema valide. Valores numéricos (duration, slideCount) se envían como número.
2. src/app/crear/[type]/page.tsx (server): mapea URL video|foto|carrusel → type video|photo|carousel (otro → notFound()). Obtiene sesión (auth) y BusinessProfile del usuario con db (precarga). SiteHeader, título por modalidad y enlace "← Volver al panel". Renderiza CreationScreen (paso 3).
3. src/components/creation/CreationScreen.tsx (client): contiene CreationForm; al enviar hace POST /api/creations/{type} con JSON; mientras espera muestra estado de carga con los pasos de la imagen de referencia ("Analizando tu información", "Aplicando estrategia de contenido", "Creando guía personalizada", "Adaptando a tu plataforma") animados en secuencia; guarda las respuestas del formulario en estado (NO se pierden si hay error). Por ahora, en éxito muestra el JSON del output en <pre> (T8 lo reemplaza); en error muestra el mensaje de la API en un aviso text-danger con botón "Reintentar" que reenvía los mismos valores. 400 con fieldErrors → marca los campos.
3b. src/app/page.tsx: si hay sesión (auth()), el botón secundario dice "Ir al panel" (→ /panel) en vez de "Iniciar sesión", y el primario "Crear mi primer guion" va a /panel.
4. Tests: tests/e2e/crear.spec.ts (Playwright, AI_PROVIDER=mock): usuario nuevo → panel → Carrusel → completa campos obligatorios → elige 7 → botón habilitado → enviar → aparece el resultado y contiene 7 láminas ("index": 7). Otro test: Fotografía con descripción corta → botón deshabilitado.
5. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
6. git add -A (sin .env) && git commit -m "feat(T7): formularios contextuales por modalidad" && git push origin main. Informe máx. 10 líneas.
