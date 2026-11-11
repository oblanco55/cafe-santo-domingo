"use client";

import { useEffect, useRef, useState } from "react";
import { loadPayPalSdk } from "./paypal-sdk";

type Common = {
  clientId: string;
  currency: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export type PayPalButtonsProps =
  | (Common & { kind: "order"; packId: string })
  | (Common & { kind: "subscription"; planId: string; paypalPlanId: string; userId: string });

async function postJson(url: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string } | undefined)?.message;
    throw new Error(msg ?? "No se pudo completar la operación.");
  }
  return json;
}

/**
 * Botones de PayPal (F2-7d). Paquetes: el servidor crea y captura la orden.
 * Planes: PayPal crea la suscripción y el servidor la verifica antes de guardarla.
 */
export default function PayPalButtons(props: PayPalButtonsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const propsRef = useRef(props);
  propsRef.current = props;

  const id = props.kind === "order" ? props.packId : props.planId;

  useEffect(() => {
    let cancelled = false;
    let close: (() => Promise<void>) | undefined;
    const p = propsRef.current;

    loadPayPalSdk(p.clientId, p.currency, p.kind)
      .then(async (paypal) => {
        if (cancelled || !ref.current) return;
        const style = { layout: "horizontal", tagline: false, height: 44, shape: "rect", label: p.kind === "order" ? "pay" : "subscribe" };
        const onError = () => propsRef.current.onError("PayPal no pudo completar el pago. No se ha cobrado nada.");
        const onCancel = () => propsRef.current.onError("Pago cancelado.");

        const options: Record<string, unknown> =
          p.kind === "order"
            ? {
                style,
                onError,
                onCancel,
                createOrder: async () => {
                  const r = await postJson(`/api/billing/packs/${encodeURIComponent(p.packId)}/order`);
                  return r.orderId as string;
                },
                onApprove: async (data: { orderID: string }) => {
                  try {
                    const r = await postJson(`/api/billing/orders/${encodeURIComponent(data.orderID)}/capture`);
                    propsRef.current.onSuccess(`¡Listo! Se añadieron ${String(r.credits)} créditos a tu cuenta.`);
                  } catch (e) {
                    propsRef.current.onError((e as Error).message);
                  }
                },
              }
            : {
                style,
                onError,
                onCancel,
                createSubscription: (_data: unknown, actions: { subscription: { create(o: unknown): Promise<string> } }) =>
                  actions.subscription.create({ plan_id: p.paypalPlanId, custom_id: p.userId }),
                onApprove: async (data: { subscriptionID: string }) => {
                  try {
                    await postJson("/api/billing/subscriptions/confirm", { subscriptionId: data.subscriptionID, planId: p.planId });
                    propsRef.current.onSuccess("¡Suscripción activada! Ya puedes seguir creando.");
                  } catch (e) {
                    propsRef.current.onError((e as Error).message);
                  }
                },
              };

        const buttons = paypal.Buttons(options);
        close = buttons.close;
        await buttons.render(ref.current);
        if (!cancelled) setState("ready");
      })
      .catch(() => !cancelled && setState("error"));

    return () => {
      cancelled = true;
      void close?.().catch(() => undefined);
    };
  }, [id, props.kind, props.clientId, props.currency]);

  return (
    <div className="min-h-[44px]">
      {state === "loading" && <p className="text-xs text-muted">Cargando PayPal…</p>}
      {state === "error" && <p className="text-xs text-danger">No se pudo cargar PayPal. Recarga la página.</p>}
      <div ref={ref} />
    </div>
  );
}
