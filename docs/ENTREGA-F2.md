# Café Santo Domingo — Entrega Fase 2

Complementa `docs/ENTREGA.md` (Fase 1). Estado a 2026-10-23. Producción: https://web-production-38743.up.railway.app

## 1. Qué incluye la Fase 2

| Área | Funcionalidad | Dónde |
|---|---|---|
| Administración | Resumen con métricas, usuarios (activar/desactivar, rol), creaciones con detalle, textos legales editables, IA, ajustes, monetización | `/admin/*` (solo rol admin) |
| IA | Cualquier proveedor del mercado: Anthropic (Claude, por defecto) y todos los compatibles con OpenAI (OpenAI, Gemini, Mistral, Groq, DeepSeek, xAI, MiniMax, OpenRouter, Together, Ollama) o **manual** con URL base propia. Prioridad y respaldo automático si uno falla. Claves cifradas (AES-256-GCM). | `/admin/ia` |
| Calidad de la IA | La IA recibe los datos en español legible, reglas de copy por plataforma, objetivo (la promoción nunca se inventa: marcador «[indica aquí tu promoción y vigencia]»), transiciones entre láminas, audio en video. Banco de evaluación `npm run eval:ia`. | `src/lib/ai/prompts`, `src/lib/ai/humanize.ts` |
| Legal | Términos y privacidad leídos de la BD (Markdown seguro), editables por el admin. | `/terminos`, `/privacidad`, `/admin/legal` |
| Monetización | Capa gratuita configurable + paquetes de créditos + suscripciones con PayPal. Desactivada por defecto. | `/admin/monetizacion`, `/planes`, `/cuenta` |
| Usuario | Mis creaciones (filtro por tipo, detalle, eliminar), Perfil del negocio, Regenerar variante (cuenta como creación). | `/creaciones`, `/creaciones/[id]`, `/perfil` |
| Seguridad | Usuario desactivado pierde la sesión al instante; rol leído de la BD; secretos solo enmascarados; webhook de PayPal con firma verificada e idempotente. | `src/lib/session.ts`, `src/lib/billing` |

## 2. Regla de acceso por creación (servidor)

1. Cobros desactivados o usuario admin → permitido.
2. Suscripción activa → hasta la cuota del plan en su periodo (vacío = ilimitado).
3. Creaciones gratis del mes (calendario UTC) por debajo de la cuota → permitido.
4. Créditos > 0 → permitido, consume 1.
5. Si no → 402 `PAYMENT_REQUIRED` y la pantalla ofrece «Ver planes» sin perder las respuestas.

Solo se descuenta cuando la creación termina bien. Regenerar cuenta como creación.

## 3. Endpoints nuevos

- Creaciones: `GET /api/creations`, `DELETE /api/creations/item/[id]` (oculta), `POST /api/creations/item/[id]/regenerate`.
- Usuario: `GET /api/billing/catalog` (público), `GET /api/billing/usage`, `POST /api/billing/packs/[id]/order`, `POST /api/billing/orders/[orderId]/capture`, `POST /api/billing/subscriptions/confirm`, `POST /api/billing/subscriptions/cancel`.
- PayPal: `POST /api/paypal/webhook` (sin sesión, firma verificada).
- Admin: `/api/admin/billing/{settings,test,plans,plans/[id],packs,packs/[id],payments,credits}`, más los de F2-3 (`users`, `creations`, `legal`, `ai/providers`, `ai/presets`, `settings`, `metrics`).

## 4. Base de datos

Migraciones aditivas (no borran datos): `fase2_admin` y `monetizacion` (Plan, CreditPack, Subscription, CreditLedger, Payment, PaymentEvent y `Creation.billingSource`). El saldo de créditos es la suma de `CreditLedger`.

Ajustes en `AppSetting`: `monetization.enabled`, `monetization.currency`, `limits.freeCreationsPerMonth`, `paypal.mode`, `paypal.clientId`, `paypal.clientSecretEnc` (cifrado), `paypal.webhookId`.

## 5. Cómo activar los cobros (sandbox)

Guía paso a paso: `docs/GUIA-CREDENCIALES.md`. Resumen:
1. `/admin/monetizacion` → General y PayPal: modo **Sandbox**, Client ID, Secret, «Probar conexión».
2. Registrar en PayPal el webhook con la URL que muestra el panel y pegar el Webhook ID.
3. Crear al menos un paquete y un plan (el plan se publica en PayPal automáticamente).
4. Activar «Cobros activados» y fijar las creaciones gratis al mes.
5. Probar una compra con la cuenta compradora de prueba de PayPal.

**Live** (cobros reales) solo tras probar todo en sandbox y con autorización expresa.

## 6. Pruebas (ejecutadas por Claude)

- `npx tsc --noEmit`: sin errores. `npm run lint`: 0 errores.
- Vitest: 278 pruebas (incluye motor de derechos, PayPal con fetch simulado, webhook, prompts).
- Playwright: 58 pruebas en escritorio y móvil (incluye `/admin/monetizacion`, `/planes`, `/cuenta`, aviso 402, Mis creaciones → regenerar → eliminar, perfil).
- Revisión manual en navegador de todo `/admin` a 375 px y 1600 px.
- Producción: comprobación de rutas tras el despliegue.


## 7. Pendiente

- Del usuario: clave de IA real en `/admin/ia` y credenciales sandbox de PayPal en `/admin/monetizacion`.
- Ejecutar `npm run eval:ia` con la IA real para revisar la calidad.
- `src/components/admin/AdminHome.tsx` es código sin uso (se puede borrar).

## 8. Reversión

- Código: Railway → Deployments → Rollback, o `git revert` y push a `main`.
- Cobros: desmarcar «Cobros activados» en `/admin/monetizacion` (efecto en ≤ 60 s, sin redeploy).
- BD: las migraciones son aditivas; revertirlas solo con respaldo previo.
