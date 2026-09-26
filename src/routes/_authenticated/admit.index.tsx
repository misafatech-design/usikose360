import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatEventDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admit/")({
  head: () => ({
    meta: [
      { title: "Admissions — Usikose360" },
      { name: "description", content: "Events you can admit guests for." },
      { property: "og:title", content: "Admissions — Usikose360" },
      { property: "og:description", content: "Scan and admit event guests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdmitList,
});

function AdmitList() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-admissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: staff }, { data: own }] = await Promise.all([
        supabase.from("event_staff").select("events(id, title, starts_at, city)").eq("user_id", user!.id),
        supabase.from("events").select("id, title, starts_at, city").eq("organizer_id", user!.id),
      ]);
      const list = [...(own ?? []), ...(staff ?? []).map((s) => s.events).filter(Boolean)] as {
        id: string;
        title: string;
        starts_at: string;
        city: string;
      }[];
      return Array.from(new Map(list.map((e) => [e.id, e])).values());
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">Admissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick an event to start scanning tickets.</p>
        <div className="mt-8 space-y-3">
          {q.isLoading && <Skeleton className="h-20 rounded-xl" />}
          {q.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">You haven't been added to any event's admission team yet.</p>
          )}
          {q.data?.map((e) => (
            <div key={e.id} className="surface-panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{e.title}</p>
                <p className="text-xs text-muted-foreground">{formatEventDate(e.starts_at)} · {e.city}</p>
              </div>
              <Button asChild size="sm">
                <Link to="/admit/$eventId" params={{ eventId: e.id }}>
                  <ScanLine className="h-4 w-4" /> Admit
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
