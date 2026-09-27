import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatEventDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/events")({
  head: () => ({
    meta: [
      { title: "Featured events — Usikose360 admin" },
      { name: "description", content: "Choose which events appear in the homepage spotlight." },
      { property: "og:title", content: "Featured events — Usikose360 admin" },
      { property: "og:description", content: "Pick events for the homepage spotlight." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEvents,
});

function AdminEvents() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["admin-events"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,city,status,starts_at,cover_url,is_featured")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function toggle(id: string, value: boolean) {
    const { error } = await supabase.from("events").update({ is_featured: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Added to homepage spotlight" : "Removed from spotlight");
    qc.invalidateQueries({ queryKey: ["admin-events"] });
    qc.invalidateQueries({ queryKey: ["featured-events"] });
  }

  if (!isAdmin) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Administrator access needed.</p>;
  }

  const list = (q.data ?? []).filter((e) => e.title.toLowerCase().includes(term.toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Featured events</h1>
      <p className="text-sm text-muted-foreground">
        Switched-on published events rotate in the homepage spotlight.
      </p>
      <div className="relative mt-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search events" className="pl-9" />
      </div>
      <div className="surface-panel mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {q.isLoading &&
          [0, 1, 2].map((i) => <Skeleton key={i} className="m-3 h-14" />)}
        {list.map((e) => (
          <div key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3">
            <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {e.cover_url && <img src={e.cover_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <Link to="/events/$eventId" params={{ eventId: e.id }} className="block truncate font-medium hover:underline">
                {e.title}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {formatEventDate(e.starts_at)} · {e.city}{" "}
                <Badge variant="secondary" className="ml-1 text-[10px]">{e.status}</Badge>
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs">
              <Sparkles className={e.is_featured ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
              <Switch checked={e.is_featured} onCheckedChange={(v) => toggle(e.id, v)} />
            </label>
          </div>
        ))}
        {!q.isLoading && list.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No events found.</p>
        )}
      </div>
    </div>
  );
}
