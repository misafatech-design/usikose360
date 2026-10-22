import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="dark relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[48rem] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Social ticketing for Kenya. Discover events, pay with M-Pesa and walk in with a QR ticket.
          </p>
        </div>
        <FooterCol
          title="Discover"
          links={[
            { to: "/events", label: "Browse events" },
            { to: "/blog", label: "Blog" },
          ]}
        />
        <FooterCol
          title="Organizers"
          links={[
            { to: "/events/new", label: "Create an event" },
            { to: "/dashboard", label: "Dashboard" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { to: "/terms", label: "Terms & conditions" },
            { to: "/privacy", label: "Privacy policy" },
          ]}
        />
      </div>
      <div className="relative border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Usikose360. All rights reserved.</p>
          <p>Payments secured by M-Pesa</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: "/events" | "/blog" | "/events/new" | "/dashboard" | "/terms" | "/privacy"; label: string }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-glow">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-muted-foreground transition hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
