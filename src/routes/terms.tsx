import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { getLegalPage } from "@/lib/content.functions";

export const Route = createFileRoute("/terms")({
  loader: () => getLegalPage({ data: { slug: "terms" } }),
  head: () => ({
    meta: [
      { title: "Terms and Conditions — Usikose360" },
      { name: "description", content: "The terms for buying and selling event tickets on Usikose360." },
      { property: "og:title", content: "Usikose360 Terms and Conditions" },
      { property: "og:description", content: "Rules for ticket buyers and event organizers on Usikose360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const page = Route.useLoaderData();
  return <LegalPage title={page.title} content={page.content} updatedAt={page.updated_at} current="terms" />;
}
