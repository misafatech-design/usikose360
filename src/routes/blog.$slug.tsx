import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RichText } from "@/components/rich-text";
import { PostCard, formatPostDate } from "@/components/post-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublishedPost, listPublishedPosts } from "@/lib/content.functions";
import { readingMinutes } from "@/lib/slug";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const [post, more] = await Promise.all([
      getPublishedPost({ data: { slug: params.slug } }),
      listPublishedPosts({ data: { limit: 4 } }),
    ]);
    if (!post) throw notFound();
    return { post, more: more.filter((p) => p.id !== post.id).slice(0, 3) };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.post;
    if (!p) {
      return { meta: [{ title: "Article unavailable — Usikose360" }, { name: "robots", content: "noindex" }] };
    }
    const desc = p.excerpt || p.content.slice(0, 155);
    const img = p.cover_url && /^https:\/\//.test(p.cover_url) ? p.cover_url : null;
    return {
      meta: [
        { title: `${p.title} — Usikose360 Blog` },
        { name: "description", content: desc },
        { property: "og:title", content: p.title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been moved or unpublished.</p>
        <Button asChild className="mt-6">
          <Link to="/blog">Back to the blog</Link>
        </Button>
      </div>
    </div>
  ),
  component: BlogPost,
});

function BlogPost() {
  const { post, more } = Route.useLoaderData();

  function share() {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: post.title, url }).catch(() => {});
    else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{post.category}</Badge>
          <span>{formatPostDate(post.published_at)}</span>
          <span>· {readingMinutes(post.content)} min read</span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
        {post.cover_url && (
          <img src={post.cover_url} alt={post.title} className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover" />
        )}
        <RichText text={post.content} className="mt-8" />
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">Enjoyed this? Share it with a friend.</p>
          <Button variant="secondary" size="sm" onClick={share}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </article>
      {more.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16">
          <h2 className="mb-5 text-xl font-bold">More from the blog</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
      <SiteFooter />
    </div>
  );
}
