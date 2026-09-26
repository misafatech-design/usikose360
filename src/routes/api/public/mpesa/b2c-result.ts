import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mpesa/b2c-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getConfigByToken } = await import("@/lib/mpesa.server");
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!(await getConfigByToken(token))) return new Response("Forbidden", { status: 403 });
        const body = (await request.json().catch(() => null)) as any;
        const r = body?.Result;
        if (!r?.OriginatorConversationID) return Response.json({ ResultCode: 0 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const code = Number(r.ResultCode);
        await supabaseAdmin
          .from("payouts")
          .update({
            status: code === 0 ? "completed" : "failed",
            result_code: code,
            result_desc: r.ResultDesc ?? null,
            mpesa_receipt: r.TransactionID ?? null,
          })
          .eq("originator_conversation_id", r.OriginatorConversationID);
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
