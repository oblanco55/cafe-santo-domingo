/**
 * Carga del JS SDK de PayPal sin dependencias (F2-7d).
 * Cada modo usa su propio namespace porque los parámetros del SDK difieren:
 * pedidos (intent=capture) y suscripciones (vault=true&intent=subscription).
 */

export type PayPalKind = "order" | "subscription";

/** Subconjunto del SDK que usamos (window[namespace]). */
export interface PayPalNamespace {
  Buttons(options: Record<string, unknown>): {
    render(container: HTMLElement): Promise<void>;
    close?(): Promise<void>;
    isEligible?(): boolean;
  };
}

const loading = new Map<string, Promise<PayPalNamespace>>();

export function loadPayPalSdk(clientId: string, currency: string, kind: PayPalKind): Promise<PayPalNamespace> {
  const namespace = kind === "order" ? "paypal_orders" : "paypal_subscriptions";
  const key = `${namespace}:${clientId}:${currency}`;
  const cached = loading.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ "client-id": clientId, currency, components: "buttons" });
  if (kind === "order") params.set("intent", "capture");
  else {
    params.set("intent", "subscription");
    params.set("vault", "true");
  }

  const promise = new Promise<PayPalNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.dataset.namespace = namespace;
    script.onload = () => {
      const ns = (window as unknown as Record<string, PayPalNamespace | undefined>)[namespace];
      if (ns) resolve(ns);
      else reject(new Error("PayPal no se cargó correctamente."));
    };
    script.onerror = () => {
      loading.delete(key);
      reject(new Error("No se pudo cargar PayPal. Revisa tu conexión."));
    };
    document.head.appendChild(script);
  });
  loading.set(key, promise);
  return promise;
}
