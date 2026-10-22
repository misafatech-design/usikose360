import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { getLegalPage } from "@/lib/content.functions";

export const Route = createFileRoute("/privacy")({
  loader: () => getLegalPage({ data: { slug: "privacy" } }),
  head: () => ({
    meta: [
      { title: "Privacy Policy — Usikose360" },
      { name: "description", content: "How Usikose360 collects, uses and protects your personal data." },
      { property: "og:title", content: "Usikose360 Privacy Policy" },
      { property: "og:description", content: "What data we collect for ticketing and payments, and your rights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const page = Route.useLoaderData();
  return <LegalPage title={page.title} content={page.content} updatedAt={page.updated_at} current="privacy" />;
}
