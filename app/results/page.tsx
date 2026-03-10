// app/results/page.tsx
import { ResultsClient } from "./ResultsClient";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; context?: string }>;
}) {
  const sp = await searchParams;
  const url = sp.url?.trim();
  const context = sp.context?.trim() || "";

  if (!url) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">UX SCAN+ results</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Missing URL parameter.
        </p>
        <p className="mt-1 text-sm">
          Try{" "}
          <code className="rounded bg-muted px-2 py-1">
            /results?url=https://example.com
          </code>
        </p>
      </main>
    );
  }

  return <ResultsClient initialUrl={url} initialContext={context} />;
}