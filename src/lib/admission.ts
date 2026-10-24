import { supabase } from "@/integrations/supabase/client";

export type AdmitResult = {
  result: "admitted" | "undone" | "already" | "invalid" | "locked" | "expired";
  code?: string;
  type?: string | null;
  name?: string | null;
  at?: string | null;
  by?: string | null;
  admitted?: number;
  total?: number;
};

export type GateSession = {
  token: string;
  event_id: string;
  event_title: string;
  starts_at: string;
  venue: string | null;
  city: string | null;
  label: string;
  email: string;
};

export type GateInfo = Omit<GateSession, "token"> & { ok: true; total: number; admitted: number; mine: number };

const GATE_KEY = "usikose.gate";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw new Error((error.message as string).replace(/^.*?ERROR:\s*/i, ""));
  return data as T;
}

/** Clean what the camera or keyboard gave us into a ticket code. */
export function cleanCode(raw: string) {
  return raw.trim().replace(/^USIKOSE:/i, "").trim().toUpperCase();
}

export const admission = {
  /** Signed-in organizer, admin or admission staff. */
  admit: (eventId: string, code: string, undo = false) =>
    rpc<AdmitResult>("admit_ticket", { _event_id: eventId, _code: code, _undo: undo }),
  createPass: (eventId: string, label: string, email: string, code?: string) =>
    rpc<{ id: string; email: string; label: string; code: string }>("create_gate_pass", {
      _event_id: eventId,
      _label: label,
      _email: email,
      _code: code || null,
    }),
  addStaff: (eventId: string, email: string) => rpc<string>("add_event_staff", { _event_id: eventId, _email: email }),
  gateLogin: (email: string, code: string) =>
    rpc<({ ok: true } & GateSession) | { ok: false; error: string }>("gate_login", { _email: email, _code: code }),
  gateInfo: (token: string) => rpc<GateInfo | { ok: false }>("gate_session_info", { _token: token }),
  gateAdmit: (token: string, code: string, undo = false) =>
    rpc<AdmitResult>("gate_admit", { _token: token, _code: code, _undo: undo }),
  gateLogout: (token: string) => rpc<void>("gate_logout", { _token: token }),
};

export const gateStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(GATE_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      window.localStorage.setItem(GATE_KEY, token);
    } catch {
      /* private mode */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(GATE_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const VIA_LABEL: Record<string, string> = {
  organizer: "Host",
  admin: "Admin",
  staff: "Staff account",
  gate_pass: "Gate pass",
};
