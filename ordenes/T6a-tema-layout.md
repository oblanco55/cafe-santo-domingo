# ORDEN T6a — Tema, tipografía, layout y componentes base (perfil: desarrollador-frontend)
LEE PRIMERO docs/DISENO.md (obligatorio; es la fuente de verdad visual). REGLAS: breve, un archivo por llamada. NO toques src/app/api, src/lib, src/auth.ts, middleware. Si un paso falla 2 veces, DETENTE.
1. src/app/globals.css: reemplázalo por el bloque exacto de DISENO.md §2 (@theme con los tokens; sin variables --background ni prefers-color-scheme).
2. src/app/layout.tsx: <html lang="es">; Plus Jakarta Sans con next/font/google (variable --font-jakarta, pesos 400–800) en lugar de Geist; metadata title "Script 28 — De ideas a contenido", description "Guiones de video, guías de fotografía y carruseles para redes sociales con IA.".
3. Crea src/components/ui/ con componentes reutilizables (client donde haga falta), siguiendo DISENO.md §4:
   - Button.tsx (variant 'primary' | 'secondary'; prop loading → texto "Procesando…" y disabled).
   - Card.tsx, Field.tsx (label + children + error con aria), Input.tsx, Textarea.tsx, Select.tsx (con aria-invalid / aria-describedby), Segmented.tsx (opciones tipo segmento con aria-pressed; props: options {value,label}[], value, onChange, name).
   - Logo.tsx: next/image de /brand/logo-script28.png, alt "Script 28", height prop (default 32), ancho proporcional (1454×354).
   - Icons.tsx: SVG inline VideoIcon, CameraIcon, CarouselIcon (láminas apiladas), CopyIcon, CheckIcon; props className; stroke currentColor.
   - SiteHeader.tsx (server): Logo + a la derecha: con sesión (auth() de '@/auth') botón secundario "Cerrar sesión" (server action signOut redirectTo '/'); sin sesión enlace "Iniciar sesión".
4. Solo colores de tokens (bg-ink, bg-night, text-mist, border-mist/15, text-danger…). Prohibido neutral-*, gray-*, etc.
5. Verifica: npx tsc --noEmit ; npm run lint ; npm test ; npm run build.
6. git add -A (sin .env) && git commit -m "feat(T6a): tema oficial, tipografía y componentes base" && git push origin main. Informe máx. 8 líneas.
