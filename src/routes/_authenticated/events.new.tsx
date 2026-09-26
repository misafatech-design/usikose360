import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CATEGORIES = ["Music", "Nightlife", "Business", "Sports", "Tech", "Food & Drink", "Faith", "General"];

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  category: z.string(),
  venue: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2).max(80),
  cover_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  starts_at: z.string().min(1),
});

type TicketDraft = { name: string; price: string; quantity: string };

export const Route = createFileRoute("/_authenticated/events/new")({
  head: () => ({
    meta: [
      { title: "Create an event — Usikose360" },
      {
        name: "description",
        content: "Publish your event, set ticket types and start selling with M-Pesa.",
      },
      { property: "og:title", content: "Create an event — Usikose360" },
      { property: "og:description", content: "List your event and sell tickets in minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateEvent,
});

function CreateEvent() {
  const { user, isOrganizer } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    description: "",
    category: "Music",
    venue: "",
    city: "Nairobi",
    cover_url: "",
    starts_at: "",
  });
  const [tickets, setTickets] = useState<TicketDraft[]>([
    { name: "Regular", price: "1000", quantity: "100" },
  ]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(status: "draft" | "published") {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    try {
      const { data: event, error } = await supabase
        .from("events")
        .insert({
          organizer_id: user.id,
          title: parsed.data.title,
          summary: parsed.data.summary || null,
          description: parsed.data.description || null,
          category: parsed.data.category,
          venue: parsed.data.venue || null,
          city: parsed.data.city,
          cover_url: parsed.data.cover_url || null,
          starts_at: new Date(parsed.data.starts_at).toISOString(),
          status,
        })
        .select()
        .single();
      if (error) throw error;

      const rows = tickets
        .filter((t) => t.name.trim())
        .map((t) => ({
          event_id: event.id,
          name: t.name.trim(),
          price_kes: Number(t.price) || 0,
          quantity: Number(t.quantity) || 0,
        }));
      if (rows.length) {
        const { error: ttError } = await supabase.from("ticket_types").insert(rows);
        if (ttError) throw ttError;
      }

      toast.success(status === "published" ? "Event published!" : "Draft saved");
      navigate({ to: "/manage/$eventId", params: { eventId: event.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the event");
    } finally {
      setBusy(false);
    }
  }

  if (!isOrganizer) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Organizer access needed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is set up for attending events. Ask an administrator to upgrade you to an
            organizer to publish events.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">Create an event</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build your event page, then add tickets and publish.
        </p>

        <div className="surface-panel mt-8 space-y-5 rounded-2xl border border-border/70 p-6">
          <div className="space-y-2">
            <Label htmlFor="title">Event title</Label>
            <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Short summary</Label>
            <Input
              id="summary"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="A short and sweet sentence about your event."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={6}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="starts">Date and time</Label>
              <Input
                id="starts"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => set("starts_at", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Input id="venue" value={form.venue} onChange={(e) => set("venue", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cover">Cover image URL</Label>
            <Input
              id="cover"
              value={form.cover_url}
              onChange={(e) => set("cover_url", e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="surface-panel mt-6 space-y-4 rounded-2xl border border-border/70 p-6">
          <h2 className="text-lg font-semibold">Tickets</h2>
          {tickets.map((t, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Input
                placeholder="Name"
                value={t.name}
                onChange={(e) =>
                  setTickets((list) =>
                    list.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
              <Input
                placeholder="Price (KES)"
                inputMode="numeric"
                value={t.price}
                onChange={(e) =>
                  setTickets((list) =>
                    list.map((x, idx) => (idx === i ? { ...x, price: e.target.value } : x)),
                  )
                }
              />
              <Input
                placeholder="Quantity"
                inputMode="numeric"
                value={t.quantity}
                onChange={(e) =>
                  setTickets((list) =>
                    list.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x)),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTickets((list) => list.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTickets((l) => [...l, { name: "", price: "0", quantity: "100" }])}
          >
            <Plus className="h-4 w-4" /> Add ticket type
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => submit("published")} disabled={busy}>
            {busy ? "Saving…" : "Publish event"}
          </Button>
          <Button variant="secondary" onClick={() => submit("draft")} disabled={busy}>
            Save as draft
          </Button>
        </div>
      </div>
    </div>
  );
}
