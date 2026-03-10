"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type A11yTopViolation = {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
};

type AuditResponse = {
  url: string;
  screenshots?: {
    desktop?: string;
    mobile?: string;
    folded?: string;
  };
  a11y: {
    violationsCount: number;
    topViolations: A11yTopViolation[];
  };
};

function normalizeImpact(impact: string | null) {
  return (impact ?? "minor").toLowerCase();
}

function calcScore(violations: A11yTopViolation[]) {
  const impacts = violations.map((v) => normalizeImpact(v.impact));

  const critical = impacts.filter((x) => x === "critical").length;
  const serious = impacts.filter((x) => x === "serious").length;
  const moderate = impacts.filter((x) => x === "moderate").length;
  const minor = impacts.filter((x) => x === "minor").length;

  const score =
    100 -
    Math.min(critical, 3) * 12 -
    Math.min(serious, 4) * 7 -
    Math.min(moderate, 5) * 4 -
    Math.min(minor, 5) * 2;

  return Math.max(30, score);
}

function scoreEmoji(score: number) {
  if (score >= 80) return "🟢";
  if (score >= 60) return "🟡";
  return "🔴";
}

function LoadingState() {
  const [step, setStep] = React.useState(1);

  React.useEffect(() => {
    const timers = [
      setTimeout(() => setStep(2), 1500),
      setTimeout(() => setStep(3), 3500),
      setTimeout(() => setStep(4), 6000),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  const steps = [
    "Loading website",
    "Capturing screenshots",
    "Running accessibility scan",
    "Preparing results",
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Analyzing website</CardTitle>
        <CardDescription>Running the audit.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          <div className="text-sm text-muted-foreground">
            Estimated time: under 1 minute
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {steps.map((label, index) => {
            const n = index + 1;
            const done = n < step;
            const current = n === step;

            return (
              <div key={label} className="flex items-center gap-3">
                <span>{done ? "✓" : current ? "●" : "○"}</span>
                <span
                  className={
                    done || current ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ResultsClient({
  initialUrl,
}: {
  initialUrl: string;
  initialContext: string;
}) {
  const [auditData, setAuditData] = React.useState<AuditResponse | null>(null);
  const [auditError, setAuditError] = React.useState<string | null>(null);
  const [auditLoading, setAuditLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function runAudit() {
      try {
        const res = await fetch(`/api/audit?url=${encodeURIComponent(initialUrl)}`, {
          cache: "no-store",
        });

        const text = await res.text();

        if (!res.ok) throw new Error(text || "Audit failed");

        const json = JSON.parse(text) as AuditResponse;

        if (!cancelled) setAuditData(json);
      } catch (e: any) {
        if (!cancelled) setAuditError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    }

    runAudit();

    return () => {
      cancelled = true;
    };
  }, [initialUrl]);

  if (auditError) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <Link href="/audit">← New audit</Link>
        <h1 className="mt-4 text-2xl font-semibold">Audit error</h1>
        <pre className="mt-4">{auditError}</pre>
      </main>
    );
  }

  if (auditLoading || !auditData) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <Link href="/audit">← New audit</Link>
        <h1 className="mt-4 text-2xl font-semibold">Audit results</h1>
        <div className="mt-2 text-sm text-muted-foreground">
          URL: {initialUrl}
        </div>
        <LoadingState />
      </main>
    );
  }

  const violations = auditData.a11y.topViolations;
  const score = calcScore(violations);
  const emoji = scoreEmoji(score);

  return (
    <main className="mx-auto max-w-4xl p-8 space-y-6">
      <Link href="/audit">← New audit</Link>

      <h1 className="text-2xl font-semibold">Audit results</h1>

      <Card>
        <CardHeader>
          <CardTitle>Accessibility score</CardTitle>
          <CardDescription>Weighted severity score</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="text-4xl font-semibold">
            {emoji} {score}/100
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Violations: {auditData.a11y.violationsCount}
          </div>
        </CardContent>
      </Card>

      {auditData.screenshots?.desktop && (
        <Card>
          <CardHeader>
            <CardTitle>Desktop screenshot</CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={auditData.screenshots.desktop}
              className="w-full rounded"
              alt="desktop"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Top accessibility issues</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {violations.map((v) => (
            <div key={v.id} className="border rounded p-3">
              <div className="font-medium">{v.help}</div>
              <div className="text-sm text-muted-foreground">
                {v.description}
              </div>
              <div className="text-xs mt-1 text-muted-foreground">
                Impact: {v.impact ?? "minor"} | Nodes: {v.nodes}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}