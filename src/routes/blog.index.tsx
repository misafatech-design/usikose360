import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PostCard, formatPostDate } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { listPublishedPosts } from "@/lib/content.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/")({
  loader: () => listPublishedPosts({ data: { limit: 100 } }),
  head: () => ({
    meta: [
      { title: "Blog — Usikose360 news, event guides and organizer tips" },
      {
        name: "description",
        content: "Event guides, organizer tips and platform news from Usikose360, Kenya's social ticketing platform.",
      },
      { property: "og:title", content: "Usikose360 Blog" },
      { property: "og:description", content: "Event guides, organizer tips and platform news." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const posts = Route.useLoaderData();
  const [cat, setCat] = useState("All");
  const cats = useMemo(() => ["All", ...Array.from(new Set(posts.map((p) => p.category)))], [posts]);
  const list = posts.filter((p) => cat === "All" || p.category === cat);
  const [lead, ...rest] = list;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="dark relative overflow-hidden bg-background">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-primary-glow/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-glow">The Usikose360 blog</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold sm:text-5xl">Stories, guides and news from the scene</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            What's happening on Usikose360 — event guides for fans and practical tips for organizers.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-lg font-semibold">No posts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon for news and event guides.</p>
            <Button asChild className="mt-5">
              <Link to="/events">Browse events</Link>
            </Button>
          </div>
        ) : (
          <>
            {cats.length > 2 && (
              <div className="-mx-1 mb-8 flex gap-2 overflow-x-auto pb-1">
                {cats.map((c) => (
                  <Button key={c} size="sm" variant={c === cat ? "default" : "secondary"} className="shrink-0" onClick={() => setCat(c)}>
                    {c}
                  </Button>
                ))}
              </div>
            )}
            {lead && (
              <Link
                to="/blog/$slug"
                params={{ slug: lead.slug }}
                className="group mb-10 grid overflow-hidden rounded-3xl border border-border/70 bg-card md:grid-cols-2"
              >
                <div className="aspect-[16/10] overflow-hidden bg-secondary md:aspect-auto">
                  {lead.cover_url ? (
                    <img src={lead.cover_url} alt={lead.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full min-h-56 w-full bg-[image:var(--gradient-brand)]" />
                  )}
                </div>
                <div className="flex flex-col justify-center gap-3 p-6 sm:p-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {lead.category} · {formatPostDate(lead.published_at)}
                  </p>
                  <h2 className="text-2xl font-bold sm:text-3xl">{lead.title}</h2>
                  {lead.excerpt && <p className="text-muted-foreground">{lead.excerpt}</p>}
                  <span className="text-sm font-semibold text-primary">Read the story →</span>
                </div>
              </Link>
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
