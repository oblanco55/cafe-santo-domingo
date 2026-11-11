# Café Santo Domingo — Fase 2: administración, IA configurable, valor para el usuario y monetización

Aprobado por el usuario el 2026-10-23 (amplía el alcance del MVP; los pagos estaban fuera de alcance en las especificaciones y ahora se incluyen por decisión del usuario).
Roles: Claude dirige y verifica; Hermes implementa. Reglas de órdenes: ver memoria de Hermes (órdenes cortas, hechos verificados, verificación automática por paso).

## Decisiones del usuario
1. **IA**: cualquier proveedor del mercado, configurable desde el panel; **Claude (Anthropic) por defecto**.
2. **Panel de administración**: textos legales, usuarios, creaciones y métricas, configuración de IA, **PayPal para monetizar**.
3. **Usuario**: Mis creaciones, Perfil del negocio, Regenerar variante.

## Decisiones técnicas (Claude)

### IA multi-proveedor
- Dos adaptadores cubren el mercado:
  - `anthropic` (nativo, tool use) — Claude. Por defecto.
  - `openai_compatible` (function calling con JSON Schema; si el proveedor no soporta tools, modo JSON + validación zod) — OpenAI, Google Gemini (endpoint compatible), Mistral, Groq, DeepSeek, xAI, OpenRouter, Together, Ollama/servidores propios.
- Presets con URL base por proveedor; el admin solo elige proveedor, modelo y pega su clave.
- Resolución: proveedor marcado por defecto en BD → si no hay, Anthropic con `ANTHROPIC_API_KEY` del entorno → si no hay, `mock` con aviso visible en el panel. Respaldo opcional: si el principal falla, se intenta el siguiente por prioridad.
- Botón «Probar conexión» por proveedor.

### Seguridad de secretos
- Claves de IA y de PayPal se guardan **cifradas** (AES-256-GCM) con `SETTINGS_ENCRYPTION_KEY` (variable de entorno, nunca en BD). La API nunca devuelve la clave: solo «••••1234».
- Todo `/admin` y `/api/admin/*` exige `role=admin` (servidor). Acciones del admin quedan registradas (`AdminAuditLog`).

### Cuenta administradora sin tocar la BD a mano
- Variable `ADMIN_EMAILS` (lista separada por comas). Un usuario cuyo correo esté ahí recibe `role=admin` al registrarse o iniciar sesión. Se configura `ADMIN_EMAILS=resp5totech@gmail.com` en Railway.

### Modelo de datos (migración aditiva)
- `AppSetting` (key, value JSON, updatedAt, updatedBy) — límites de uso, IA por defecto, monetización.
- `AIProvider` (id, label, kind anthropic|openai_compatible, baseUrl, model, apiKeyEnc, enabled, isDefault, priority, timestamps).
- `LegalDocument` (slug terminos|privacidad, title, content Markdown, version, updatedAt, updatedBy) — sembrado con el texto provisional actual.
- `User.active` (bool, default true) — cuentas desactivadas no pueden iniciar sesión.
- `Creation.hiddenAt` (borrado por el usuario = ocultar; se conserva para auditoría) y `Creation.parentId` (variantes regeneradas).
- `AdminAuditLog` (adminId, action, target, detail JSON, createdAt).
- Monetización (tras la decisión de modelo): `Plan`, `Subscription`/`Payment`, `PaymentEvent` (webhooks idempotentes).

## Tareas (orden de ejecución)

| # | Tarea | Perfil Hermes | Depende |
|---|---|---|---|
| F2-0 | Cerrar T10 (pulido QA en curso) | desarrollador-frontend | — |
| F2-1 | Migración de datos + cifrado + `ADMIN_EMAILS` + cuentas desactivadas | desarrollador-backend | F2-0 |
| F2-2 | IA multi-proveedor (adaptadores, presets, resolución, prueba de conexión) | especializado-en-inteligencia-artificial | F2-1 |
| F2-3 | API admin: usuarios, creaciones, métricas, textos legales, IA, ajustes + auditoría | desarrollador-backend | F2-1, F2-2 |
| F2-4 | Panel admin UI (`/admin`: Resumen, Usuarios, Creaciones, Textos legales, IA, Ajustes) | desarrollador-frontend | F2-3 |
| F2-5 | Textos legales públicos desde BD (Markdown seguro) | desarrollador-frontend | F2-3 |
| F2-6 | Usuario: Mis creaciones, Perfil del negocio, Regenerar variante | desarrollador-frontend + backend | F2-1 |
| F2-7 | PayPal: configuración en admin + cobro según el modelo elegido + webhooks | desarrollador-backend + frontend | decisión del usuario |
| F2-8 | E2E de Fase 2, despliegue, actualización de `docs/ENTREGA.md` | Claude verifica | todas |

## Variables de entorno nuevas
`SETTINGS_ENCRYPTION_KEY` (32 bytes base64), `ADMIN_EMAILS`. PayPal se configura desde el panel (client ID / secret cifrado / modo sandbox|live).

## Riesgos
- Calidad de proveedores con soporte parcial de tools → mitigado con modo JSON + validación + reintento.
- Pagos: probar siempre en **sandbox** de PayPal antes de `live`; no se activará `live` sin autorización explícita.
- Hermes es lento e inestable en tareas grandes → órdenes pequeñas con verificación automática.

## F2-7 Monetización (decisión del usuario 2026-10-23)
**Modelo**: capa gratuita configurable + paquetes de créditos + suscripciones; todo configurable por el admin.

### Regla de acceso por creación (servidor, en este orden)
1. Monetización desactivada o usuario admin → permitido.
2. Suscripción ACTIVA → permitido hasta la cuota del plan en su periodo (`null` = ilimitado).
3. Creaciones gratis del mes < cuota gratuita → permitido (gratis).
4. Saldo de créditos > 0 → permitido, consume 1 crédito.
5. Si no → 402 `PAYMENT_REQUIRED` con enlace a `/planes`.
Solo se descuenta cuando la creación termina con éxito (las fallidas no cuentan). Regenerar cuenta como creación.

### Datos (migración aditiva)
- `Plan` (nombre, descripción, precio en centavos, moneda, intervalo month|year, creationsPerPeriod Int?, paypalProductId?, paypalPlanId?, active, sortOrder).
- `CreditPack` (nombre, credits, precio en centavos, moneda, active, sortOrder).
- `Subscription` (userId, planId, paypalSubscriptionId único, status, currentPeriodStart/End, timestamps).
- `CreditLedger` (userId, delta ±, reason purchase|creation|admin_adjust|refund, refType/refId, createdAt) — saldo = suma.
- `Payment` (userId, kind credit_pack|subscription, paypalOrderId/captureId únicos, amountCents, currency, status, raw Json).
- `PaymentEvent` (id del evento PayPal único, tipo, payload, processedAt) — idempotencia de webhooks.
- Ajustes: `monetization.enabled`, `limits.freeCreationsPerMonth`, `monetization.currency`, `paypal.mode` (sandbox|live), `paypal.clientId`, `paypal.clientSecretEnc` (cifrado), `paypal.webhookId`.

### PayPal (REST v2, sin SDK de servidor)
- Token OAuth2 con client_credentials (caché hasta expirar). URL base según modo: sandbox `https://api-m.sandbox.paypal.com`, live `https://api-m.paypal.com`.
- Paquetes: Orders v2 — el servidor crea la orden, el usuario aprueba con los botones JS de PayPal, el servidor captura y acredita los créditos (idempotente por captureId).
- Suscripciones: al guardar un Plan, el servidor crea producto y plan en PayPal (Catalog Products + Billing Plans) y guarda los IDs; el usuario se suscribe con los botones JS (`createSubscription` con plan_id); el servidor verifica en PayPal que la suscripción está ACTIVE antes de guardarla; cancelar desde «Mi cuenta» llama a la API de PayPal.
- Webhook `/api/paypal/webhook`: verifica la firma con `verify-webhook-signature`; procesa BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED/SUSPENDED/EXPIRED, PAYMENT.SALE.COMPLETED (renueva periodo), PAYMENT.CAPTURE.COMPLETED/REFUNDED (reembolso → resta créditos). Idempotente por id de evento.
- **Siempre sandbox** hasta que el usuario autorice explícitamente `live`.

### Tareas
| # | Tarea | Perfil |
|---|---|---|
| F2-7a | Datos + motor de derechos (entitlements) + 402 en creaciones | desarrollador-backend |
| F2-7b | Cliente PayPal, APIs de compra/suscripción y webhook | desarrollador-backend |
| F2-7c | Admin «Monetización»: credenciales PayPal, capa gratuita, planes, paquetes, pagos, ajuste manual de créditos | desarrollador-frontend |
| F2-7d | Usuario: `/planes` (gratis, planes, paquetes, botones PayPal) y `/cuenta` (uso del mes, créditos, suscripción, cancelar) | desarrollador-frontend |
| F2-7e | E2E con PayPal simulado + prueba real en sandbox con credenciales del usuario | Claude verifica |
