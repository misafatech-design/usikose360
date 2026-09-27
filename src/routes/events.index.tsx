import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { EventCard } from "@/components/event-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, fetchPublishedEvents } from "@/lib/events-query";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Browse all events — Usikose360" },
      { name: "description", content: "Filter concerts, conferences, sports and nightlife across Kenya by city, date and price." },
      { property: "og:title", content: "Browse all events — Usikose360" },
      { property: "og:description", content: "Find your next event and pay with M-Pesa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrowseEvents,
});

type DateFilter = "any" | "today" | "week" | "month";

function BrowseEvents() {
  const [open, setOpen] = useState(true);
  const [term, setTerm] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [city, setCity] = useState("all");
  const [date, setDate] = useState<DateFilter>("any");
  const [maxPrice, setMaxPrice] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState("soonest");

  const { data, isLoading } = useQuery({ queryKey: ["published-events"], queryFn: fetchPublishedEvents });
  const cities = useMemo(() => Array.from(new Set((data ?? []).map((e) => e.city))).sort(), [data]);

  const events = useMemo(() => {
    const now = Date.now();
    const limit = { any: Infinity, today: 1, week: 7, month: 31 }[date] * 86400000;
    const max = Number(maxPrice) || Infinity;
    const list = (data ?? []).filter((e) => {
      const t = term.toLowerCase();
      if (t && !`${e.title} ${e.city} ${e.venue ?? ""}`.toLowerCase().includes(t)) return false;
      if (cats.length && !cats.includes(e.category)) return false;
      if (city !== "all" && e.city !== city) return false;
      const start = new Date(e.starts_at).getTime();
      if (date !== "any" && (start < now - 86400000 || start > now + limit)) return false;
      if (freeOnly && (e.from_price ?? 0) > 0) return false;
      if (e.from_price != null && e.from_price > max) return false;
      return true;
    });
    if (sort === "price") list.sort((a, b) => (a.from_price ?? 0) - (b.from_price ?? 0));
    if (sort === "latest") list.reverse();
    return list;
  }, [data, term, cats, city, date, maxPrice, freeOnly, sort]);

  const activeCount = cats.length + (city !== "all" ? 1 : 0) + (date !== "any" ? 1 : 0) + (maxPrice ? 1 : 0) + (freeOnly ? 1 : 0);
  const reset = () => {
    setCats([]);
    setCity("all");
    setDate("any");
    setMaxPrice("");
    setFreeOnly(false);
  };

  const filters = (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold">Category</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={cats.includes(c)}
                onCheckedChange={(v) => setCats((l) => (v ? [...l, c] : l.filter((x) => x !== c)))}
              />
              {c}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>City</Label>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Date</Label>
        <div className="flex flex-wrap gap-2">
          {(["any", "today", "week", "month"] as DateFilter[]).map((d) => (
            <Button key={d} size="sm" variant={date === d ? "default" : "outline"} onClick={() => setDate(d)}>
              {{ any: "Any time", today: "Today", week: "This week", month: "This month" }[d]}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="max">Max price (KES)</Label>
        <Input id="max" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 2000" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={freeOnly} onCheckedChange={(v) => setFreeOnly(!!v)} /> Free events only
        </label>
      </div>
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="h-4 w-4" /> Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Browse events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything happening across Kenya.</p>
          <div className="relative mt-5 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search events, venues or cities" className="h-12 bg-background pl-9" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-fit">
                <SlidersHorizontal className="h-4 w-4" /> Filters
                {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeCount}</span>}
                <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">{events.length} events</span>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="soonest">Soonest</SelectItem>
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="price">Lowest price</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={open ? "grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]" : ""}>
            <CollapsibleContent>
              <aside className="surface-panel rounded-xl border border-border p-5 lg:sticky lg:top-20">{filters}</aside>
            </CollapsibleContent>
            <div className="min-w-0">
              {isLoading ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
                </div>
              ) : events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                  No events match these filters.
                </div>
              ) : (
                <div className={`grid gap-5 sm:grid-cols-2 ${open ? "xl:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-4"}`}>
                  {events.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              )}
            </div>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
