import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

// Public read-only events API for third-party calendar sync and integrations.
export const Route = createFileRoute("/api/public/v1/events")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
                h.delete("Authorization");
              }
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const url = new URL(request.url);
        const city = url.searchParams.get("city");
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

        let query = supabase
          .from("events")
          .select("id,title,summary,category,city,venue,starts_at,ends_at,cover_url")
          .eq("status", "published")
          .order("starts_at", { ascending: true })
          .limit(limit);
        if (city) query = query.eq("city", city);

        const { data, error } = await query;
        if (error) {
          return new Response(JSON.stringify({ error: "Unable to load events" }), {
            status: 500,
            headers: CORS,
          });
        }
        return new Response(JSON.stringify({ data }), { status: 200, headers: CORS });
      },
    },
  },
});
