import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/qr")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const d = new URL(request.url).searchParams.get("d") ?? "";
        if (!/^[A-Za-z0-9-]{4,40}$/.test(d)) return new Response("Bad request", { status: 400 });
        const QRCode = (await import("qrcode")).default;
        const png = await QRCode.toBuffer(d, { type: "png", width: 300, margin: 1, errorCorrectionLevel: "M" });
        return new Response(new Uint8Array(png), {
          headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" },
        });
      },
    },
  },
});
