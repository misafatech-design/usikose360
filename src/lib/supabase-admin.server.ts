// Server-only privileged database client that works on any host (Lovable, Vercel, Render).
// Reads the connection from runtime env first, then falls back to the build-time browser URL,
// so a deploy that only set VITE_SUPABASE_URL still reaches the same project as the browser.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

function keyedFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewKey(key) && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

export function serverDbUrl(): string | undefined {
  return (
    env("SUPABASE_URL") ||
    env("VITE_SUPABASE_URL") ||
    (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ||
    undefined
  );
}

export function browserDbUrl(): string | undefined {
  return (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) || env("VITE_SUPABASE_URL");
}

export function serviceKey(): string | undefined {
  return env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_KEY");
}

export function publishableKey(): string | undefined {
  return (
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("SUPABASE_ANON_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
    undefined
  );
}

function create() {
  const url = serverDbUrl();
  const key = serviceKey();
  if (!url || !key) {
    const missing = [...(!url ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_SERVICE_ROLE_KEY"] : [])];
    const msg = `Server setup incomplete: add ${missing.join(" and ")} to your hosting environment variables, then redeploy.`;
    console.error(`[db] ${msg}`);
    throw new Error(msg);
  }
  return createClient<Database>(url, key, {
    global: { fetch: keyedFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let client: ReturnType<typeof create> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof create>, {
  get(_, prop, receiver) {
    if (!client) client = create();
    return Reflect.get(client, prop, receiver);
  },
});

/** Read-only public client (respects row security) for anonymous reads on the server. */
export function publicServerClient() {
  const url = serverDbUrl();
  const key = publishableKey();
  if (!url || !key) throw new Error("Server setup incomplete: add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  return createClient<Database>(url, key, {
    global: { fetch: keyedFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Explain a database error in words an admin can act on. */
export function explainDbError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid api key") || m.includes("jwt") || m.includes("unauthorized"))
    return "The server's SUPABASE_SERVICE_ROLE_KEY does not belong to the project in SUPABASE_URL. Copy both from the same Supabase project and redeploy.";
  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("network"))
    return "The server cannot reach the database. Check SUPABASE_URL in your hosting environment variables.";
  if (m.includes("does not exist") || m.includes("schema cache"))
    return "The database is missing tables. Run supabase/setup.sql in your Supabase SQL editor.";
  return message || "Database error";
}

function host(u?: string) {
  try {
    return u ? new URL(u).host : "";
  } catch {
    return "";
  }
}

/** True when the server and the browser talk to the same database project. */
export function sameProject() {
  const a = host(serverDbUrl());
  const b = host(browserDbUrl());
  return !a || !b || a === b;
}
