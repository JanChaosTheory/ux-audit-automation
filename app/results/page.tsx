// app/results/page.tsx
import { headers } from "next/headers";
import { ResultsClient, type AuditResponse } from "./ResultsClient";

export const dynamic = "force-dynamic";

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";

  return `${protocol}://${host}`;
}

function formatErrorText(text: string) {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text || "Unknown error";
  }
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; context?: string }>;
}) {
  const sp = await searchParams;
  const url = sp.url?.trim();
  const context = sp.context?.trim();

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

  const baseUrl = await getBaseUrl();
  const apiUrl = `${baseUrl}/api/audit?url=${encodeURIComponent(url)}${
    context ? `&context=${encodeURIComponent(context)}` : ""
  }`;

  const res = await fetch(apiUrl, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    const formattedError = formatErrorText(text);

    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">UX SCAN+ results</h1>
        <p className="mt-2 text-sm text-destructive">
          Audit could not be completed.
        </p>
        <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-6">
          {formattedError}
        </pre>
      </main>
    );
  }

  const data = (await res.json()) as AuditResponse;

  return <ResultsClient data={{ ...data, context }} />;
}