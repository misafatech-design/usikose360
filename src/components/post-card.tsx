import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PostSummary } from "@/lib/content.functions";

export function formatPostDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
}

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[var(--shadow-card)]"
    >
      <div className="aspect-[16/9] overflow-hidden bg-secondary">
        {post.cover_url ? (
          <img
            src={post.cover_url}
            alt={post.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-[image:var(--gradient-brand)] opacity-80" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{post.category}</Badge>
          <span>{formatPostDate(post.published_at)}</span>
        </div>
        <h3 className="line-clamp-2 text-lg font-semibold">{post.title}</h3>
        {post.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
          Read more <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}
