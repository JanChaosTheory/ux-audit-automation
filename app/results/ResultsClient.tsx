"use client";

import * as React from "react";

export function ResultsClient({
  initialUrl,
  initialContext,
}: {
  initialUrl: string;
  initialContext: string;
}) {
  const [status, setStatus] = React.useState("mounting");
  const [result, setResult] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("calling /api/audit");

        const params = new URLSearchParams({
          url: initialUrl,
          context: initialContext || "",
        });

        const res = await fetch(`/api/audit?${params.toString()}`, {
          cache: "no-store",
        });

        const text = await res.text();

        if (cancelled) return;

        setStatus(`done, status ${res.status}`);
        setResult(text.slice(0, 2000));
      } catch (e: any) {
        if (cancelled) return;
        setStatus(`error: ${String(e?.message ?? e)}`);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [initialUrl, initialContext]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Results debug</h1>
      <p className="mt-4 text-sm">URL: {initialUrl}</p>
      <p className="mt-2 text-sm">Context: {initialContext || "-"}</p>
      <p className="mt-6 text-sm font-medium">Status: {status}</p>

      <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">
        {result || "No result yet"}
      </pre>
    </main>
  );
}