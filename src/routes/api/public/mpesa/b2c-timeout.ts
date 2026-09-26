import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mpesa/b2c-timeout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getConfigByToken } = await import("@/lib/mpesa.server");
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!(await getConfigByToken(token))) return new Response("Forbidden", { status: 403 });
        const body = (await request.json().catch(() => null)) as any;
        const id = body?.Result?.OriginatorConversationID ?? body?.OriginatorConversationID;
        if (id) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("payouts")
            .update({ status: "failed", result_desc: "Timed out at M-Pesa" })
            .eq("originator_conversation_id", id)
            .eq("status", "processing");
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
