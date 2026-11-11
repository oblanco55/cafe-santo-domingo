# ORDEN T8b — Corregir tipos de salida (perfil: arquitecto). Breve; informe máx. 8 líneas. Si falla 2 veces, DETENTE.
Claude verificó: el commit T8 (960da28) NO compila (npm run build → "Failed to compile"; tsc: 13 errores en src/components/creation/format.ts y ResultView.tsx: "Property 'slides'/'scenes'/'general_setup' does not exist on type 'ZodObject<…>'").
Causa raíz (src/lib/contracts/outputs.ts líneas ~103-172): CarouselOutput y VideoOutput son alias del TIPO DEL ESQUEMA (ReturnType<typeof carouselOutputFor>) en vez del tipo de DATOS.
1. En outputs.ts: `export type CarouselOutput = z.infer<ReturnType<typeof carouselOutputFor>>;` y `export type VideoOutput = z.infer<ReturnType<typeof videoOutputFor>>;` (sin genéricos). Mantén CarouselOutputSchema/VideoOutputSchema si alguien los usa. Ajusta los usos que dejen de compilar (src/lib/ai, src/components/creation) sin cambiar lógica.
2. npx tsc --noEmit (0 errores) ; npm run lint ; npm test ; npm run build (debe compilar) ; npm run test:e2e.
3. OBLIGATORIO: git add -A (sin .env) && git commit -m "fix(T8): tipos de salida de carrusel y video (z.infer)" && git push origin main.
