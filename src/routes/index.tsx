import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  Plug,
} from "lucide-react";
import heroImage from "@/assets/hero-crowd.jpg";
import { SiteHeader } from "@/components/site-header";
import { EventCard } from "@/components/event-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublishedEvents } from "@/lib/events-query";
import { Logo } from "@/components/brand";

const CATEGORIES = [
  "All",
  "Music",
  "Nightlife",
  "Business",
  "Sports",
  "Tech",
  "Food & Drink",
  "Faith",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Usikose360 — Discover events and buy tickets with M-Pesa" },
      {
        name: "description",
        content:
          "Find concerts, conferences and festivals across Kenya. Buy tickets with M-Pesa and get instant e-tickets from Usikose360.",
      },
      { property: "og:title", content: "Usikose360 — Never miss an event" },
      {
        property: "og:description",
        content: "Discover events near you and pay for tickets with M-Pesa in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [category, setCategory] = useState("All");
  const [term, setTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["published-events"],
    queryFn: fetchPublishedEvents,
  });

  const featured = (data ?? []).filter((e) => e.is_featured).slice(0, 3);

  const events = (data ?? []).filter((e) => {
    const matchCat = category === "All" || e.category === category;
    const matchTerm =
      !term ||
      e.title.toLowerCase().includes(term.toLowerCase()) ||
      e.city.toLowerCase().includes(term.toLowerCase());
    return matchCat && matchTerm;
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="dark relative isolate overflow-hidden bg-background">
        <img
          src={heroImage}
          alt="Crowd at a live event in Nairobi"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary-glow">
            Social ticketing for Kenya
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
            Never miss a moment. <span className="text-gradient-brand">Usikose360.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Discover events near you, pay with M-Pesa in seconds, and get your ticket instantly.
            Organizers get live sales, attendance tracking and payouts in one place.
          </p>

          <div className="mt-8 grid max-w-xl grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search events or city"
                className="h-12 pl-9"
              />
            </div>
            <Button size="lg" className="h-12 shrink-0 glow-ring" asChild>
              <Link to="/events">Browse all</Link>
            </Button>
          </div>

          {featured.length > 0 && (
            <div className="mt-12">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary-glow">
                Featured events
              </p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <div className="h-6" />

      <section className="mx-auto max-w-7xl px-4 pb-6">
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={c === category ? "default" : "secondary"}
              onClick={() => setCategory(c)}
              className="shrink-0"
            >
              {c}
            </Button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <h2 className="mb-5 text-2xl font-bold">Upcoming events</h2>
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="surface-panel rounded-xl border border-border/70 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No events published yet. Be the first to list one.
            </p>
            <Button asChild className="mt-4">
              <Link to="/events/new">Create an event</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-border/70 bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-2xl font-bold">Everything organizers need</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Smartphone,
                title: "M-Pesa checkout",
                body: "Buyers pay by phone. Organizers get payouts to their till or paybill.",
              },
              {
                icon: BarChart3,
                title: "Live analytics",
                body: "Sales, revenue and attendance metrics update as tickets sell.",
              },
              {
                icon: Bell,
                title: "Automated emails",
                body: "Confirmations, reminders and updates go out without lifting a finger.",
              },
              {
                icon: Share2,
                title: "Social sharing",
                body: "One-tap sharing to WhatsApp, X, Facebook and more to drive turnout.",
              },
              {
                icon: ShieldCheck,
                title: "Roles and permissions",
                body: "Separate access for attendees, organizers and administrators.",
              },
              {
                icon: Plug,
                title: "Open API",
                body: "A public events endpoint for calendar sync and third-party tools.",
              },
            ].map((f) => (
              <div key={f.title} className="surface-panel rounded-xl border border-border/70 p-6">
                <f.icon className="h-6 w-6 text-primary-glow" />
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <Logo />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Usikose360
          </p>
        </div>
      </footer>
    </div>
  );
}
