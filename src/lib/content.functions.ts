import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LEGAL_PAGES, type LegalSlug } from "./legal-defaults";

export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  category: string;
  published_at: string | null;
};

export type Post = PostSummary & { content: string; updated_at: string };

const db = async () => (await import("@/lib/supabase-admin.server")).publicServerClient();

export const listPublishedPosts = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number } | undefined) => z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}))
  .handler(async ({ data }): Promise<PostSummary[]> => {
    try {
      const { data: rows, error } = await (await db())
        .from("posts")
        .select("id,slug,title,excerpt,cover_url,category,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(data.limit ?? 50);
      if (error) throw error;
      return rows ?? [];
    } catch (e) {
      console.error("[blog] list failed", e);
      return [];
    }
  });

export const getPublishedPost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }): Promise<Post | null> => {
    const { data: row, error } = await (await db())
      .from("posts")
      .select("id,slug,title,excerpt,cover_url,category,published_at,content,updated_at")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      console.error("[blog] get failed", error);
      return null;
    }
    return row;
  });

export const getLegalPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: LegalSlug }) => z.object({ slug: z.enum(["terms", "privacy"]) }).parse(d))
  .handler(async ({ data }) => {
    const fallback = { title: LEGAL_PAGES[data.slug].title, content: LEGAL_PAGES[data.slug].content, updated_at: null as string | null };
    try {
      const { data: row } = await (await db())
        .from("site_pages")
        .select("title,content,updated_at")
        .eq("slug", data.slug)
        .maybeSingle();
      if (row && row.content.trim()) return row;
    } catch (e) {
      console.error("[legal] load failed", e);
    }
    return fallback;
  });
