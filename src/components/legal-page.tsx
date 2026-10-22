import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RichText } from "@/components/rich-text";

export function LegalPage({
  title,
  content,
  updatedAt,
  current,
}: {
  title: string;
  content: string;
  updatedAt: string | null;
  current: "terms" | "privacy";
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Legal</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{title}</h1>
          {updatedAt && (
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated {new Date(updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          <div className="mt-6 flex gap-2 text-sm">
            <Link
              to="/terms"
              className={`rounded-full px-4 py-1.5 ${current === "terms" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              className={`rounded-full px-4 py-1.5 ${current === "privacy" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
            >
              Privacy
            </Link>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <RichText text={content} />
      </main>
      <SiteFooter />
    </div>
  );
}
