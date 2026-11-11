# ORDEN F2-6 — Mis creaciones, Perfil del negocio y Regenerar (perfil: desarrollador-frontend)
LEE docs/DISENO.md. Usa src/components/ui y src/components/creation. Breve; un archivo por llamada; informe máx. 10 líneas. Si falla 2 veces, DETENTE.
HECHOS: Creation tiene hiddenAt y parentId (F2-1). Existen POST /api/creations/[type], GET /api/creations/item/[id], GET/PUT /api/profile, ResultView y CreationForm.
1. API:
   - GET /api/creations?type=&page= → creaciones propias con hiddenAt null, status ok: { id, type, title (output.title), platform, createdAt, parentId }, 20 por página, más recientes primero.
   - DELETE /api/creations/item/[id] → marca hiddenAt (solo propias; 404 si no). GET item de una oculta → 404 para el usuario.
   - POST /api/creations/item/[id]/regenerate → toma el input de la creación propia, llama a generateCreation con el mismo tipo e input, guarda nueva Creation con parentId = id; responde como el POST normal (201 {id,type,output}). Respeta el mismo límite de uso.
2. UI:
   - /creaciones (protegida): lista con filtro por modalidad (Todas/Video/Fotografía/Carrusel), tarjetas con icono, título, plataforma, fecha relativa; vacío: mensaje + botón al panel. Clic → /creaciones/[id].
   - /creaciones/[id]: ResultView con la salida guardada + botones "Regenerar variante" (POST regenerate → navega a la nueva), "Eliminar" (confirmación → DELETE → /creaciones); si tiene parentId, enlace "Ver original".
   - En ResultView tras generar (CreationScreen) añade "Regenerar variante" (reenvía las mismas respuestas) y un enlace "Ver en Mis creaciones".
   - /perfil (protegida): formulario del perfil del negocio (país, producto/servicio, sector + otro, descripción) con GET/PUT /api/profile y "Guardado".
   - Panel y SiteHeader: enlaces a "Mis creaciones" y "Perfil del negocio".
3. Tests: Vitest de las 3 rutas nuevas (propiedad/404, hidden, regenerate crea hijo con parentId); E2E: generar → aparece en /creaciones → regenerar crea una segunda → eliminar la quita de la lista; editar perfil → la siguiente creación lo precarga.
4. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
5. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(F2-6): mis creaciones, perfil del negocio y regenerar variante" && git push origin main.
