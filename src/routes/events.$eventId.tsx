import { resolveCover } from "@/components/cover-upload";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, MapPin, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutDialog, type CheckoutTicketType } from "@/components/checkout-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatEventDate, formatKes } from "@/lib/format";

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Event details — Usikose360" },
      {
        name: "description",
        content: "View event details, ticket options and pay with M-Pesa on Usikose360.",
      },
      { property: "og:title", content: "Event on Usikose360" },
      {
        property: "og:description",
        content: "Get your ticket in seconds with M-Pesa checkout.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventPage,
});

function EventPage() {
  const { eventId } = Route.useParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, ticket_types(*)")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  function share(target: "whatsapp" | "x" | "facebook" | "copy") {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Check out ${data?.title ?? "this event"} on Usikose360`;
    if (target === "copy") {
      navigator.clipboard.writeText(url);
      toast.success("Link copied");
      return;
    }
    const links = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    };
    window.open(links[target], "_blank", "noopener");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      {isLoading ? (
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-10">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      ) : !data ? (
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Event not found</h1>
          <Button asChild className="mt-4">
            <Link to="/">Browse events</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="surface-panel overflow-hidden rounded-2xl border border-border/70">
              {data.cover_url ? (
                <img
                  src={resolveCover(data.cover_url)}
                  alt={data.title}
                  className="aspect-[21/9] w-full object-cover"
                />
              ) : (
                <div className="aspect-[21/9] w-full bg-secondary" />
              )}
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                <Badge variant="secondary">{data.category}</Badge>
                <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{data.title}</h1>
                {data.summary && (
                  <p className="mt-3 text-base text-muted-foreground">{data.summary}</p>
                )}

                <div className="mt-6 grid gap-3 text-sm">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-primary-glow" />
                    {formatEventDate(data.starts_at)}
                  </p>
                  <p className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-primary-glow" />
                    <span className="truncate">
                      {data.venue ? `${data.venue}, ${data.city}` : data.city}
                    </span>
                  </p>
                </div>

                {data.description && (
                  <div className="mt-8">
                    <h2 className="text-lg font-semibold">About this event</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {data.description}
                    </p>
                  </div>
                )}

                <div className="mt-8">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Share2 className="h-4 w-4" /> Share
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => share("whatsapp")}>
                      WhatsApp
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => share("x")}>
                      X
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => share("facebook")}>
                      Facebook
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => share("copy")}>
                      Copy link
                    </Button>
                  </div>
                </div>
              </div>

              <aside className="surface-panel h-fit rounded-2xl border border-border/70 p-5 lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold">Tickets</h2>
                <div className="mt-4 space-y-3">
                  {(data.ticket_types ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No tickets on sale for this event yet.
                    </p>
                  )}
                  {(data.ticket_types ?? []).map((t) => {
                    const soldOut = t.sold >= t.quantity;
                    return (
                      <div key={t.id} className="rounded-xl border border-border/70 p-4">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{t.name}</p>
                            {t.description && (
                              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                            )}
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" /> {Math.max(0, t.quantity - t.sold)} left
                            </p>
                          </div>
                          <p className="shrink-0 font-semibold text-primary-glow">
                            {formatKes(Number(t.price_kes))}
                          </p>
                        </div>
                        <Button
                          className="mt-3 w-full"
                          disabled={soldOut}
                          onClick={() => {
                            setSelected(t.id);
                            setOpen(true);
                          }}
                        >
                          {soldOut ? "Sold out" : "Get tickets"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          </div>

          <CheckoutDialog
            open={open}
            onOpenChange={setOpen}
            initialTicketId={selected}
            ticketTypes={(data.ticket_types ?? []).map(
              (t): CheckoutTicketType => ({
                id: t.id,
                name: t.name,
                price_kes: Number(t.price_kes),
                event_id: data.id,
                description: t.description,
                remaining: Math.max(0, t.quantity - t.sold),
              }),
            )}
            eventTitle={data.title}
          />
        </>
      )}
    </div>
  );
}
