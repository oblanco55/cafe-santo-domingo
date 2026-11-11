# ORDEN F2-7c — Admin «Monetización» (perfil: desarrollador-frontend)
HECHOS VERIFICADOS POR CLAUDE (estructura real del repo, 2026-10-23): códigos de error en src/lib/contracts/api.ts (`export type ApiErrorCode = 'VALIDATION' | 'UNAUTHORIZED' | 'FORBIDDEN' | …`); sesión en src/lib/session.ts (requireUser, requireAdmin, UnauthenticatedError, ForbiddenError); auditoría en src/lib/audit.ts (`logAdminAction(admin, …)`); cifrado en src/lib/crypto.ts; errores HTTP con jsonError en src/lib/api-errors.ts; ajustes: tabla AppSetting (ver cómo la lee src/lib/admin.ts ~línea 567). Ejecuta `ls src/lib src/app/api src/app/admin src/components/admin` antes de empezar y reutiliza lo existente; NO dupliques helpers.
Panel admin real: navegación en src/app/admin/nav.tsx (array LINKS con {href,label,icon}: añade { href: '/admin/monetizacion', label: 'Monetización', icon: '💳' }); componentes en src/components/admin/ (patrón: página fina en src/app/admin/<x>/page.tsx que renderiza un componente cliente src/components/admin/<X>.tsx, con helpers de src/components/admin/ui.tsx); usuarios en src/components/admin/Usuarios.tsx (ahí va la acción 'Ajustar créditos'). Las respuestas de la API van envueltas en objetos ({ settings }, { plans }, { packs }, { items, count, page, pageSize }): LEE la ruta antes de consumirla.
LEE docs/DISENO.md y PLAN-F2.md §F2-7. Usa src/components/ui y el layout de /admin existente. Breve; un archivo por llamada; informe máx. 8 líneas. Si un paso falla 2 veces, DETENTE.
HECHOS: APIs de F2-7b en /api/admin/billing/{settings,test,plans,packs,payments,credits}. Ejecuta `ls -R src/app/api/admin/billing src/app/admin` primero.
1. Añade "Monetización" a la navegación de /admin.
2. /admin/monetizacion con pestañas o secciones:
   - General: interruptor "Cobros activados", "Creaciones gratis al mes" (0 = sin capa gratuita), moneda (USD por defecto).
   - PayPal: modo (Sandbox / Live — Live muestra aviso text-warning "Cobros reales"), Client ID, Client Secret (password; muestra la máscara; vacío = no cambiar), Webhook ID, botón "Probar conexión", y texto con la URL del webhook a registrar en PayPal: `${origin}/api/paypal/webhook`.
   - Planes de suscripción: tabla + formulario (nombre, descripción, precio, intervalo mensual/anual, creaciones por periodo o "Ilimitado", activo, orden); muestra si tiene paypalPlanId ("Sincronizado con PayPal") o el error.
   - Paquetes de créditos: tabla + formulario (nombre, créditos, precio, activo, orden).
   - Pagos: tabla paginada (fecha, usuario, tipo, importe, estado).
   - En /admin/usuarios: acción "Ajustar créditos" (cantidad ± y nota) → POST credits.
3. Precios: el usuario escribe en unidades (p. ej. 9.99) y se envían en centavos.
4. Test e2e (rutas de PayPal simuladas con page.route): el admin guarda ajustes, crea un paquete y un plan y aparecen en las tablas.
5. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
6. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(F2-7c): administración de monetización" && git push origin main.
