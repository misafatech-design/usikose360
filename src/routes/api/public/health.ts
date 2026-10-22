import { createFileRoute } from "@tanstack/react-router";

// Public setup check: reports only yes/no flags and public hostnames — never keys or settings.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const m = await import("@/lib/supabase-admin.server");
        const hostOf = (u?: string) => {
          try {
            return u ? new URL(u).host : null;
          } catch {
            return null;
          }
        };
        const env = {
          SUPABASE_URL: !!process.env["SUPABASE_URL"],
          SUPABASE_PUBLISHABLE_KEY: !!(process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"]),
          SUPABASE_SERVICE_ROLE_KEY: !!m.serviceKey(),
          VITE_SUPABASE_URL: !!m.browserDbUrl(),
          VITE_SUPABASE_PUBLISHABLE_KEY: !!import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
        };
        const result: Record<string, unknown> = {
          env,
          server_db_host: hostOf(m.serverDbUrl()),
          browser_db_host: hostOf(m.browserDbUrl()),
          same_project: m.sameProject(),
          database: { reachable: false, error: null as string | null, missing_tables: [] as string[] },
          mpesa: { active: null as string | null },
          email: { enabled: false },
        };
        try {
          const db = m.supabaseAdmin;
          const tables = ["events", "ticket_types", "orders", "tickets", "mpesa_config", "email_settings", "posts", "site_pages"] as const;
          const checks = await Promise.all(
            tables.map(async (t) => ({ t, r: await db.from(t).select("*", { count: "exact", head: true }) })),
          );
          const firstErr = checks.find((c) => c.r.error && !/does not exist|schema cache/i.test(c.r.error.message));
          const db_ = result["database"] as { reachable: boolean; error: string | null; missing_tables: string[] };
          db_.missing_tables = checks.filter((c) => c.r.error && /does not exist|schema cache/i.test(c.r.error.message)).map((c) => c.t);
          if (firstErr) db_.error = m.explainDbError(firstErr.r.error!.message);
          else db_.reachable = true;
          if (db_.reachable) {
            const [{ data: mp }, { data: em }] = await Promise.all([
              db.from("mpesa_config").select("environment, shortcode, consumer_key, passkey").eq("is_active", true).maybeSingle(),
              db.from("email_settings").select("enabled, host").eq("id", 1).maybeSingle(),
            ]);
            (result["mpesa"] as { active: string | null }).active =
              mp && mp.shortcode && mp.consumer_key && mp.passkey ? mp.environment : null;
            (result["email"] as { enabled: boolean }).enabled = !!(em?.enabled && em.host);
          }
        } catch (e) {
          (result["database"] as { error: string | null }).error = e instanceof Error ? e.message : "Database error";
        }
        return Response.json(result, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
