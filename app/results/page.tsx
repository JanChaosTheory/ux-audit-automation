// app/results/page.tsx
import { ResultsClient, type AuditResponse } from "./ResultsClient";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const sp = await searchParams;
  const url = sp.url?.trim();

  if (!url) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Results</h1>
        <p className="mt-2 text-sm text-muted-foreground">Missing url param.</p>
        <p className="mt-1 text-sm">
          Try{" "}
          <code className="rounded bg-muted px-2 py-1">
            /results?url=https://uxpilot.ai/ai-ui-list
          </code>
        </p>
      </main>
    );
  }

  const apiUrl = `${getBaseUrl()}/api/audit?url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Results</h1>
        <p className="mt-2 text-sm text-destructive">Audit failed.</p>
        <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">
          {text}
        </pre>
      </main>
    );
  }

  const data = (await res.json()) as AuditResponse;
  return <ResultsClient data={data} />;
}