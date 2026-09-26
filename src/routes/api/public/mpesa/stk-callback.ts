import { createFileRoute } from "@tanstack/react-router";
import { failOrder, fulfillOrder, getConfigByToken } from "@/lib/mpesa.server";

const ok = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });

export const Route = createFileRoute("/api/public/mpesa/stk-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const config = await getConfigByToken(token);
        if (!config) return new Response("Forbidden", { status: 403 });

        const body = (await request.json().catch(() => null)) as any;
        const cb = body?.Body?.stkCallback;
        if (!cb?.CheckoutRequestID) return ok();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, total_kes")
          .eq("checkout_request_id", cb.CheckoutRequestID)
          .maybeSingle();
        if (!order) return ok();

        const code = Number(cb.ResultCode);
        if (code === 0) {
          const items: { Name: string; Value?: string | number }[] = cb.CallbackMetadata?.Item ?? [];
          const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
          const amount = Number(items.find((i) => i.Name === "Amount")?.Value ?? 0);
          if (amount && amount + 0.5 < Math.round(Number(order.total_kes))) {
            await failOrder(order.id, -2, `Amount mismatch: paid ${amount}`);
          } else {
            await fulfillOrder(order.id, receipt ? String(receipt) : null, cb.ResultDesc ?? "Paid");
          }
        } else {
          await failOrder(order.id, code, cb.ResultDesc ?? "Payment failed");
        }
        return ok();
      },
    },
  },
});
