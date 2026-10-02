import { resolveCover } from "@/components/cover-upload";
import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEventDate, formatKes } from "@/lib/format";

export type EventCardData = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  city: string;
  venue: string | null;
  cover_url: string | null;
  starts_at: string;
  from_price?: number | null;
};

export function EventCard({ event }: { event: EventCardData }) {
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="group surface-panel flex flex-col overflow-hidden rounded-xl border border-border/70 transition hover:border-primary/60"
    >
      <div className="aspect-[16/9] w-full overflow-hidden bg-secondary">
        {event.cover_url ? (
          <img
            src={resolveCover(event.cover_url)}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            {event.category}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <Badge variant="secondary" className="w-fit text-[11px]">
          {event.category}
        </Badge>
        <h3 className="line-clamp-2 text-base font-semibold">{event.title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {formatEventDate(event.starts_at)}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {event.venue ? `${event.venue}, ${event.city}` : event.city}
          </span>
        </p>
        <p className="mt-auto pt-2 text-sm font-semibold text-primary-glow">
          {event.from_price == null ? "See tickets" : `From ${formatKes(event.from_price)}`}
        </p>
      </div>
    </Link>
  );
}
