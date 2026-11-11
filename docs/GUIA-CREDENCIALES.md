# Guía: credenciales de IA y PayPal para Script 28

Estas claves las pegas **tú** en el panel de administración (`/admin`). Se guardan cifradas y el panel nunca vuelve a mostrarlas completas. No las envíes por chat ni por correo.

Antes de empezar: inicia sesión en https://web-production-38743.up.railway.app con `resp5totech@gmail.com`. Si ya tenías la sesión abierta antes de que existiera el panel, **cierra sesión y vuelve a entrar** para que tome el rol de administrador.

---

## 1. Clave de Claude (IA por defecto)

1. Entra en https://console.anthropic.com e inicia sesión (o crea la cuenta de la empresa).
2. **Billing**: añade un método de pago y un saldo inicial (las generaciones se cobran por uso).
3. **API Keys → Create Key**. Nómbrala `script28-produccion` y cópiala (empieza por `sk-ant-…`; solo se muestra una vez).
4. En Script 28: **/admin → IA → Añadir proveedor**:
   - Proveedor: **Anthropic (Claude)**.
   - Modelo: deja el sugerido (`claude-sonnet-5-5`).
   - Clave: pega la clave.
   - Marca **Activo** y **Por defecto**.
5. Pulsa **Probar conexión** → debe responder "OK" con la latencia.
6. Crea una guía de prueba (Fotografía o Carrusel) desde el panel de usuario: el resultado ya debe ser específico de lo que escribiste, no el texto genérico del modo simulado.

**Otras IA** (opcional, como respaldo): el mismo formulario admite OpenAI, Google Gemini, Mistral, Groq, DeepSeek, xAI, OpenRouter, Together y Ollama. Con varias activas, si la principal falla se usa la siguiente según la prioridad.

---

## 2. PayPal en modo de pruebas (sandbox)

Con sandbox **no se mueve dinero real**: PayPal crea cuentas ficticias de comprador y vendedor.

1. Entra en https://developer.paypal.com con la cuenta PayPal **Business** de la empresa.
2. **Apps & Credentials** → asegúrate de que arriba está seleccionado **Sandbox**.
3. **Create App** → nombre `Script 28`, tipo **Merchant**. Copia el **Client ID** y el **Secret**.
4. **Testing Tools → Sandbox Accounts**: verás una cuenta *Personal* (comprador de prueba). Anota su correo y contraseña de prueba para simular compras.
5. Cuando exista la sección **/admin → Monetización** (tarea F2-7):
   - Modo: **Sandbox**.
   - Pega **Client ID** y **Secret**.
   - Pulsa **Probar conexión**.
   - Copia la **URL del webhook** que muestra el panel (`…/api/paypal/webhook`).
6. De vuelta en developer.paypal.com → tu app → **Webhooks → Add Webhook**: pega esa URL y marca los eventos `BILLING.SUBSCRIPTION.*`, `PAYMENT.SALE.COMPLETED`, `PAYMENT.CAPTURE.COMPLETED` y `PAYMENT.CAPTURE.REFUNDED`. Copia el **Webhook ID** que te da PayPal y pégalo en el panel.
7. En el panel configura la capa gratuita, al menos un paquete de créditos y un plan, y haz una compra con la cuenta comprador de prueba.

### Pasar a cobros reales (solo cuando todo funcione en sandbox)
Repite los pasos 2–6 con el selector en **Live** (credenciales distintas) y cambia el modo a **Live** en el panel. Avísame antes: lo verificamos juntos.

---

## Qué NO hacer
- No pegues claves en el chat, en documentos ni en el repositorio.
- No uses las credenciales Live hasta haber probado todo el flujo en Sandbox.
- Si una clave se expone, revócala en la consola del proveedor y crea otra.
