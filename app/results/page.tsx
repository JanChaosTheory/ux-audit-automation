// app/results/page.tsx
import { ResultsClient } from "./ResultsClient";

export const dynamic = "force-dynamic";

export default function ResultsPage({
  searchParams,
}: {
  searchParams: { url?: string; context?: string };
}) {
  const url = searchParams.url?.trim();
  const context = searchParams.context?.trim() || "";

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