import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { VIA_LABEL } from "@/lib/admission";

export type AdmittedTicket = {
  id: string;
  code: string;
  checked_in_at: string | null;
  admitted_by_name: string | null;
  admitted_via: string | null;
  ticket_types: { name: string } | null;
};

const RESULT_TONE: Record<string, string> = {
  admitted: "text-success",
  undone: "text-muted-foreground",
  already: "text-warning",
  locked: "text-warning",
  invalid: "text-destructive",
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

/** Who admitted how many guests, plus a live feed of every scan. */
export function AdmissionStats({ eventId, tickets }: { eventId: string; tickets: AdmittedTicket[] }) {
  const log = useQuery({
    queryKey: ["admission-log", eventId],
    refetchInterval: 15000,
    queryFn: async () =>
      (
        await supabase
          .from("admission_log")
          .select("id, code, ticket_type, attendee_name, result, actor_name, via, created_at")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
          .limit(40)
      ).data ?? [],
  });

  const board = useMemo(() => {
    const m = new Map<string, { name: string; via: string; count: number; types: Map<string, number>; last: string }>();
    for (const t of tickets) {
      if (!t.checked_in_at) continue;
      const name = t.admitted_by_name ?? "Before tracking";
      const row = m.get(name) ?? { name, via: t.admitted_via ?? "", count: 0, types: new Map(), last: t.checked_in_at };
      row.count++;
      const type = t.ticket_types?.name ?? "Ticket";
      row.types.set(type, (row.types.get(type) ?? 0) + 1);
      if (t.checked_in_at > row.last) row.last = t.checked_in_at;
      m.set(name, row);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [tickets]);

  const byType = useMemo(() => {
    const m = new Map<string, { total: number; in: number }>();
    for (const t of tickets) {
      const k = t.ticket_types?.name ?? "Ticket";
      const r = m.get(k) ?? { total: 0, in: 0 };
      r.total++;
      if (t.checked_in_at) r.in++;
      m.set(k, r);
    }
    return [...m.entries()];
  }, [tickets]);

  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Trophy className="h-5 w-5 text-primary" /> Who admitted guests
        </h2>
        {board.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No one has been admitted yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {board.map((r, i) => (
              <li key={r.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {VIA_LABEL[r.via] ?? "—"} · {[...r.types.entries()].map(([k, v]) => `${v} ${k}`).join(", ")} · last {time(r.last)}
                  </p>
                </div>
                <span className="text-xl font-bold tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
        {byType.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By ticket type</p>
            <div className="mt-2 space-y-2">
              {byType.map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate">{k}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {v.in}/{v.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${v.total ? (v.in / v.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Activity className="h-5 w-5 text-primary" /> Live scan feed
        </h2>
        {(log.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Scans appear here as they happen.</p>
        ) : (
          <ul className="mt-3 max-h-96 divide-y divide-border overflow-y-auto">
            {log.data!.map((l) => (
              <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="font-mono font-semibold">{l.code}</span>
                    {l.ticket_type ? <span className="text-muted-foreground"> · {l.ticket_type}</span> : null}
                    {l.attendee_name ? <span className="text-muted-foreground"> · {l.attendee_name}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">by {l.actor_name ?? "—"}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={RESULT_TONE[l.result]}>
                    {l.result}
                  </Badge>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{time(l.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
