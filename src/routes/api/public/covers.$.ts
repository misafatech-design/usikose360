import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/covers/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        // Public read with the publishable key, so it works on any host without the service key.
        const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        const res = await fetch(`${url}/storage/v1/object/event-covers/${path}`, { headers: { apikey: key } });
        if (!res.ok) return new Response("Not found", { status: 404 });
        const data = await res.blob();
        const error = null;
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "Content-Type": data.type || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
