"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ViolationCard } from "@/components/ui/ViolationCard";
import { FeedbackRow } from "@/components/ui/feedback-buttons";

export type A11yTopViolation = {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
};

export type AuditResponse = {
  url: string;
  context?: string;
  a11y: {
    violationsCount: number;
    topViolations: A11yTopViolation[];
  };
};

type SynthesisResponse = {
  summary: string[];
  topRisks: string[];
  quickWins: string[];
  decision: "ship" | "caution" | "do_not_ship";
  decisionReason: string;
  screenshots?: {
    desktop?: string;
    mobile?: string;
    folded?: string;
  };
};

type TabKey = "summary" | "screenshots" | "a11y";
type FeedbackType = "summary" | "risk" | "quickwin";

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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scoreEmoji(score: number) {
  if (score >= 80) return "🟢";
  if (score >= 60) return "🟡";
  return "🔴";
}

function decisionEmoji(decision?: SynthesisResponse["decision"]) {
  if (decision === "ship") return "🟢";
  if (decision === "caution") return "🟡";
  if (decision === "do_not_ship") return "🔴";
  return "🟡";
}

function pickByPrefix(items: string[], prefix: string) {
  return items.filter((item) =>
    item.toLowerCase().startsWith(prefix.toLowerCase())
  );
}

function stripPrefix(item: string, prefix: string) {
  return item.replace(new RegExp(`^${prefix}\\s*:?\\s*`, "i"), "").trim();
}

function sharedItems(items: string[]) {
  return items.filter((item) => {
    const lower = item.toLowerCase();
    return (
      !lower.startsWith("desktop") &&
      !lower.startsWith("mobile") &&
      !lower.startsWith("shared")
    );
  });
}

function LoadingState({
  currentStep,
}: {
  currentStep: 1 | 2 | 3 | 4;
}) {
  const steps = [
    "Loading website",
    "Capturing screenshots",
    "Running accessibility scan",
    "Generating UX summary",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyzing website</CardTitle>
        <CardDescription>
          We are scanning the page, capturing screenshots, and generating a UX
          report.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          <div className="text-sm text-muted-foreground">
            Estimated time: 2 to 3 minutes
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {steps.map((step, index) => {
            const stepNumber = (index + 1) as 1 | 2 | 3 | 4;
            const isDone = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;

            return (
              <div key={step} className="flex items-center gap-3">
                <span
                  className={
                    isDone
                      ? "text-foreground"
                      : isCurrent
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                  }
                >
                  {isDone ? "✓" : isCurrent ? "●" : "○"}
                </span>
                <span
                  className={
                    isDone || isCurrent
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground">
        The report will appear automatically when the analysis finishes.
        </div>
      </CardContent>
    </Card>
  );
}

function SectionList({
  title,
  items,
  emptyText,
  feedbackType,
}: {
  title: string;
  items: string[];
  emptyText: string;
  feedbackType: FeedbackType;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="font-medium">{title}</div>

      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          {items.map((item, index) => (
            <FeedbackRow
              key={`${title}-${index}`}
              text={item}
              type={feedbackType}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">{emptyText}</div>
      )}
    </div>
  );
}

export function ResultsClient({ data }: { data: AuditResponse }) {
  const violations = data.a11y.topViolations;
  const context = data.context || "";

  const score = React.useMemo(() => calcScore(violations), [violations]);
  const scoreChip = scoreEmoji(score);

  const [activeTab, setActiveTab] = React.useState<TabKey>("summary");
  const [synth, setSynth] = React.useState<SynthesisResponse | null>(null);
  const [synthLoading, setSynthLoading] = React.useState(false);
  const [synthError, setSynthError] = React.useState<string | null>(null);
  const [loadingStep, setLoadingStep] = React.useState<1 | 2 | 3 | 4>(1);

  const runSynthesisOnce = React.useCallback(async () => {
    const res = await fetch("/api/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: data.url,
        context,
        a11y: data.a11y,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "GPT analysis failed");
    }

    return (await res.json()) as SynthesisResponse;
  }, [data.url, data.a11y, context]);

  const runSynthesis = React.useCallback(async () => {
    try {
      setSynthError(null);
      setSynthLoading(true);
      setLoadingStep(1);

      try {
        const firstTry = await runSynthesisOnce();
        setSynth(firstTry);
        return;
      } catch {
        await sleep(500);
      }

      const secondTry = await runSynthesisOnce();
      setSynth(secondTry);
    } catch (e: any) {
      setSynth(null);
      setSynthError(String(e?.message ?? e));
    } finally {
      setSynthLoading(false);
    }
  }, [runSynthesisOnce]);

  React.useEffect(() => {
    void runSynthesis();
  }, [runSynthesis]);

  React.useEffect(() => {
    if (!synthLoading) return;

    setLoadingStep(1);

    const timers = [
      setTimeout(() => setLoadingStep(2), 10_000),
      setTimeout(() => setLoadingStep(3), 40_000),
      setTimeout(() => setLoadingStep(4), 80_000),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [synthLoading]);

  const gptChip = decisionEmoji(synth?.decision);

  const summaryDesktop = React.useMemo(() => {
    return pickByPrefix(synth?.summary ?? [], "desktop").map((item) =>
      stripPrefix(item, "desktop")
    );
  }, [synth]);

  const summaryMobile = React.useMemo(() => {
    return pickByPrefix(synth?.summary ?? [], "mobile").map((item) =>
      stripPrefix(item, "mobile")
    );
  }, [synth]);

  const summaryShared = React.useMemo(() => {
    return [
      ...pickByPrefix(synth?.summary ?? [], "shared"),
      ...sharedItems(synth?.summary ?? []),
    ].map((item) => stripPrefix(item, "shared"));
  }, [synth]);

  const isLoadingView = synthLoading && !synth && !synthError;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-8">
        <div className="mb-4">
          <Link
            href="/audit"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← New audit
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Audit results</h1>

            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">URL:</span>{" "}
              <a
                href={data.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {data.url}
              </a>
            </div>

            {context && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Context:</span>{" "}
                {context}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (isLoadingView) return;
              setActiveTab(value as TabKey);
            }}
          >
            <TabsList className="w-full justify-start">
              <TabsTrigger value="summary" disabled={isLoadingView}>
                Summary
              </TabsTrigger>
              <TabsTrigger value="screenshots" disabled={isLoadingView}>
                Screenshots
              </TabsTrigger>
              <TabsTrigger value="a11y" disabled={isLoadingView}>
                Accessibility
              </TabsTrigger>
            </TabsList>

            {isLoadingView ? (
              <div className="mt-4">
                <LoadingState currentStep={loadingStep} />
              </div>
            ) : (
              <>
                <TabsContent value="summary" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Accessibility score</CardTitle>
                      <CardDescription>
                        Softer weighted severity model.
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-semibold">
                          {scoreChip} {score}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /100
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-muted-foreground">
                        Violations: {data.a11y.violationsCount}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle>GPT analysis</CardTitle>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void runSynthesis()}
                          disabled={synthLoading}
                        >
                          {synthLoading ? "Running..." : "Re-run"}
                        </Button>
                      </div>

                      <CardDescription>
                        Short, practical summary for this audit.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 text-sm">
                      {!synthLoading && synthError && (
                        <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                          <div className="font-medium">GPT analysis failed</div>
                          <div className="text-sm text-muted-foreground">
                            {synthError}
                          </div>
                          <div>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => void runSynthesis()}
                            >
                              Try again
                            </Button>
                          </div>
                        </div>
                      )}

                      {!synthLoading && !synthError && !synth && (
                        <div className="rounded-md border p-4 text-center text-muted-foreground">
                          No GPT output yet.
                        </div>
                      )}

                      {!synthLoading && !synthError && synth && (
                        <>
                          <div className="rounded-md border bg-muted/30 p-4">
                            <div className="font-medium">Decision</div>
                            <div className="mt-1 text-muted-foreground">
                              {gptChip} {synth.decision}:{" "}
                              {synth.decisionReason}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="font-medium">Summary</div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <SectionList
                                title="Desktop"
                                items={summaryDesktop}
                                emptyText="No desktop-specific issues called out."
                                feedbackType="summary"
                              />

                              <SectionList
                                title="Mobile"
                                items={summaryMobile}
                                emptyText="No mobile-specific issues called out."
                                feedbackType="summary"
                              />
                            </div>

                            <SectionList
                              title="Shared issues"
                              items={summaryShared}
                              emptyText="No shared issues called out."
                              feedbackType="summary"
                            />
                          </div>

                          <div>
                            <div className="font-medium">Top risks</div>
                            <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
                              {synth.topRisks.map((item, index) => (
                                <FeedbackRow
                                  key={`risk-${index}`}
                                  text={item}
                                  type="risk"
                                />
                              ))}
                            </ul>
                          </div>

                          <div>
                            <div className="font-medium">Quick wins</div>
                            <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
                              {synth.quickWins.map((item, index) => (
                                <FeedbackRow
                                  key={`quickwin-${index}`}
                                  text={item}
                                  type="quickwin"
                                />
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="screenshots" className="mt-4 space-y-4">
                  {synth?.screenshots &&
                  (synth.screenshots.desktop ||
                    synth.screenshots.mobile ||
                    synth.screenshots.folded) ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Screenshots</CardTitle>
                        <CardDescription>
                          Captured page snapshots for quick visual inspection.
                        </CardDescription>
                      </CardHeader>

                      <CardContent>
                        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                          {synth.screenshots.desktop && (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                Desktop, above the fold
                              </div>
                              <div className="rounded-md border bg-muted/20 p-2">
                                <img
                                  src={synth.screenshots.desktop}
                                  alt="Desktop screenshot"
                                  className="h-[220px] w-full rounded object-contain"
                                />
                              </div>
                            </div>
                          )}

                          {synth.screenshots.mobile && (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                Mobile, above the fold
                              </div>
                              <div className="rounded-md border bg-muted/20 p-2">
                                <img
                                  src={synth.screenshots.mobile}
                                  alt="Mobile screenshot"
                                  className="mx-auto h-[420px] w-auto rounded object-contain"
                                />
                              </div>
                            </div>
                          )}

                          {synth.screenshots.folded && (
                            <div className="space-y-2 lg:col-span-2">
                              <div className="text-xs text-muted-foreground">
                                Desktop, scrolled section
                              </div>
                              <div className="rounded-md border bg-muted/20 p-2">
                                <img
                                  src={synth.screenshots.folded}
                                  alt="Folded screenshot"
                                  className="h-[260px] w-full rounded object-contain"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No screenshots available.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="a11y" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Accessibility score</CardTitle>
                      <CardDescription>
                        Softer weighted severity model.
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-semibold">
                          {scoreChip} {score}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /100
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-muted-foreground">
                        Violations: {data.a11y.violationsCount}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Violations</CardTitle>
                      <CardDescription>
                        All detected accessibility issues.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {violations.map((violation) => (
                        <ViolationCard key={violation.id} v={violation} />
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>
    </main>
  );
}