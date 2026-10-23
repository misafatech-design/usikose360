import { getRequest } from "@tanstack/react-start/server";

/** The website the request came from (custom-domain aware). The browser's window origin wins when it matches. */
export function requestOrigin(claimed?: string) {
  const req = getRequest();
  const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const fwdProto = req.headers.get("x-forwarded-proto")?.split(",")[0];
  const own = fwdHost
    ? `${fwdProto ?? (fwdHost.includes("localhost") ? "http" : "https")}://${(fwdHost.split(",")[0] ?? fwdHost).trim()}`
    : new URL(req.url).origin;
  const hdr = req.headers.get("origin");
  if (claimed) {
    try {
      const c = new URL(claimed).origin;
      if ((hdr && new URL(hdr).origin === c) || new URL(own).host === new URL(c).host) return c;
    } catch {
      /* ignore */
    }
  }
  return hdr || own;
}
