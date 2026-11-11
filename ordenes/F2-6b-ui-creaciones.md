# ORDEN F2-6b — Mis creaciones, Perfil del negocio y Regenerar en la UI (perfil: desarrollador-frontend). LEE docs/DISENO.md. Breve; un archivo por llamada; informe máx. 8 líneas. Si un paso falla 2 veces, DETENTE.
ATENCIÓN: nada de esto existe todavía (verificado por Claude 18:20). Debes CREAR los archivos. El vigilante comprueba que exista src/app/creaciones/page.tsx.
HECHOS VERIFICADOS:
- APIs (F2-6a): GET /api/creations?type=&page= → { count, page, pageSize, items:[{id,type,title,platform,createdAt,parentId}] }; GET /api/creations/item/[id] → { id, type, input, output, status, createdAt, parentId }; DELETE /api/creations/item/[id]; POST /api/creations/item/[id]/regenerate → 201 { id, type, output } o 402 { error: { code: 'PAYMENT_REQUIRED', message } }. Perfil: GET/PUT /api/profile (ya existe; lee su ruta antes de usarla).
- Páginas de usuario: patrón de src/app/panel/page.tsx (SiteHeader + main + Card). Página protegida: patrón de src/app/cuenta/page.tsx (auth() y redirect('/login')).
- Cabecera: src/components/ui/SiteHeader.tsx tiene el array USER_LINKS = [{href:'/planes',…},{href:'/cuenta',…}]. AÑADE al principio { href: '/creaciones', label: 'Mis creaciones' } y { href: '/perfil', label: 'Perfil del negocio' }. No cambies nada más de la cabecera.
- Resultado: src/components/creation/ResultView.tsx (props type, output, onCreateAnother, onEdit). Pantalla de creación: src/components/creation/CreationScreen.tsx (ya maneja 402 con el estado paymentRequired y el enlace «Ver planes»; NO lo quites). Formulario del perfil: reutiliza los catálogos de src/lib/contracts/catalogs.ts y los componentes de src/components/ui.
TAREAS:
1. src/app/creaciones/page.tsx (protegida) + componente cliente src/components/creation/MisCreaciones.tsx: filtro Todas/Video/Fotografía/Carrusel (Segmented), tarjetas con tipo, título, plataforma y fecha (es-ES); vacío → mensaje + botón a /panel; paginación; clic → /creaciones/[id].
2. src/app/creaciones/[id]/page.tsx (protegida) + cliente: carga GET item; muestra ResultView; botones «Regenerar variante» (POST regenerate → router.push a la nueva; si 402 muestra el mensaje y enlace a /planes), «Eliminar» (confirm → DELETE → /creaciones); si parentId, enlace «Ver original».
3. ResultView: añade prop opcional `onRegenerate?: () => void` y `regenerating?: boolean`; si viene, muestra botón «Regenerar variante». En CreationScreen pásalo: reenvía las mismas respuestas (handleSubmit(formValues)). Añade también un enlace «Ver en Mis creaciones» (/creaciones).
4. src/app/perfil/page.tsx (protegida) + cliente: formulario país, producto/servicio, sector (+ «otro» con texto), descripción; GET/PUT /api/profile; mensaje «Guardado».
5. src/middleware.ts: añade /creaciones y /perfil a las rutas privadas de UI y al matcher.
6. Enlaces en SiteHeader (USER_LINKS, ver arriba).
7. E2E tests/e2e/mis-creaciones.spec.ts (usa registerNewUser y fillCommon de tests/e2e/helpers.ts): generar una foto → aparece en /creaciones → abrir → «Regenerar variante» crea una segunda → «Eliminar» la quita; /perfil guarda y al recargar conserva el valor.
8. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
9. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(F2-6b): mis creaciones, perfil del negocio y regenerar variante" && git push origin main.
