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

type SynthesisResponse = {
  summary: string[];
  topRisks: string[];
  quickWins: string[];
  decision: "ship" | "caution" | "do_not_ship";
  decisionReason: string;
};

type FixResponse = {
  prompt: string;
  source: "gpt" | "fallback";
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

function formatErrorText(text: string) {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text || "Unknown error";
  }
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
            Estimated time: under 1 minute
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
        <ul className="mt-2 space-y-2 text-muted-foreground">
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

function QuickWinRow({
  text,
  onGenerateFix,
}: {
  text: string;
  onGenerateFix: () => void;
}) {
  return (
    <li className="border-t first:border-t-0">
      <div className="flex items-center justify-between gap-6 py-3">
        <div className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">
          {text}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGenerateFix}
          className="shrink-0"
        >
          <span aria-hidden="true">✨</span>
          <span>Generate fix</span>
        </Button>
      </div>
    </li>
  );
}

function FixPromptModal({
  open,
  issue,
  prompt,
  loading,
  copied,
  onClose,
  onCopy,
}: {
  open: boolean;
  issue: string | null;
  prompt: string;
  loading: boolean;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:rounded-xl">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />

        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <div className="text-base font-semibold">Suggested fix prompt</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Paste this into Cursor, Claude, or ChatGPT to generate the fix.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto space-y-4 px-5 py-4 sm:max-h-none">
          {issue && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick win
              </div>
              <div className="mt-1 text-sm">{issue}</div>
            </div>
          )}

          <div className="rounded-md border bg-muted/20 p-3">
            {loading ? (
              <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                Generating fix prompt...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm leading-6">
                {prompt}
              </pre>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          <div className="text-xs text-muted-foreground">
            {copied ? "Prompt copied." : "Ready to copy and use."}
          </div>

          <Button size="sm" onClick={onCopy} disabled={loading || !prompt}>
            {copied ? "Copied" : "Copy prompt"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ResultsClient({
  initialUrl,
  initialContext,
}: {
  initialUrl: string;
  initialContext: string;
}) {
  const context = initialContext || "";

  const [auditData, setAuditData] = React.useState<AuditResponse | null>(null);
  const [auditError, setAuditError] = React.useState<string | null>(null);
  const [auditLoading, setAuditLoading] = React.useState(true);

  const [activeTab, setActiveTab] = React.useState<TabKey>("summary");
  const [synth, setSynth] = React.useState<SynthesisResponse | null>(null);
  const [synthLoading, setSynthLoading] = React.useState(false);
  const [synthError, setSynthError] = React.useState<string | null>(null);
  const [loadingStep, setLoadingStep] = React.useState<1 | 2 | 3 | 4>(1);

  const [fixModalOpen, setFixModalOpen] = React.useState(false);
  const [selectedFixIssue, setSelectedFixIssue] = React.useState<string | null>(
    null
  );
  const [fixPrompt, setFixPrompt] = React.useState("");
  const [fixLoading, setFixLoading] = React.useState(false);
  const [fixCopied, setFixCopied] = React.useState(false);

  const runSynthesisOnce = React.useCallback(async () => {
    if (!auditData) {
      throw new Error("Missing audit data");
    }

    const res = await fetch("/api/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: auditData.url,
        context,
        a11y: auditData.a11y,
      }),
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(formatErrorText(text) || "GPT analysis failed");
    }

    return JSON.parse(text) as SynthesisResponse;
  }, [auditData, context]);

  const runSynthesis = React.useCallback(async () => {
    try {
      setSynthError(null);
      setSynthLoading(true);

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
    let cancelled = false;

    async function runAudit() {
      try {
        setAuditLoading(true);
        setAuditError(null);

        const params = new URLSearchParams({
          url: initialUrl,
          context,
        });

        const res = await fetch(`/api/audit?${params.toString()}`, {
          cache: "no-store",
        });

        const text = await res.text();

        if (!res.ok) {
          throw new Error(formatErrorText(text) || "Audit failed");
        }

        const json = JSON.parse(text) as AuditResponse;

        if (!cancelled) {
          setAuditData({ ...json, context });
        }
      } catch (e: any) {
        if (!cancelled) {
          setAuditError(String(e?.message ?? e));
          setAuditData(null);
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    }

    void runAudit();

    return () => {
      cancelled = true;
    };
  }, [initialUrl, context]);

  React.useEffect(() => {
    if (!auditLoading && auditData && !synth && !synthLoading) {
      void runSynthesis();
    }
  }, [auditLoading, auditData, synth, synthLoading, runSynthesis]);

  React.useEffect(() => {
    if (!(auditLoading || synthLoading)) return;

    const timers = [
      setTimeout(() => {
        setLoadingStep((prev) => Math.max(prev, 2) as 1 | 2 | 3 | 4);
      }, 1500),
      setTimeout(() => {
        setLoadingStep((prev) => Math.max(prev, 3) as 1 | 2 | 3 | 4);
      }, 3500),
      setTimeout(() => {
        setLoadingStep((prev) => Math.max(prev, 4) as 1 | 2 | 3 | 4);
      }, 6000),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [auditLoading, synthLoading]);

  const violations = auditData?.a11y.topViolations ?? [];
  const screenshots = auditData?.screenshots;
  const score = React.useMemo(() => calcScore(violations), [violations]);
  const scoreChip = scoreEmoji(score);
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

  const isLoadingView = auditLoading || (!!auditData && synthLoading && !synth);
  const showFeedbackBanner = !auditLoading && !synthLoading && !!synth;

  async function handleGenerateFix(issue: string) {
    const activeUrl = auditData?.url || initialUrl;

    setSelectedFixIssue(issue);
    setFixPrompt("");
    setFixCopied(false);
    setFixLoading(true);
    setFixModalOpen(true);

    try {
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issue,
          url: activeUrl,
          context,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed to generate fix prompt");
      }

      const json = JSON.parse(text) as FixResponse;
      setFixPrompt(json.prompt);
    } catch {
      setFixPrompt(
        `You are a senior UX engineer.

Fix the following usability issue:

"${issue}"

Page URL:
${activeUrl}

${context ? `Context:\n${context}\n\n` : ""}Provide:
- specific UI changes
- accessibility improvements
- realistic implementation guidance
- no unnecessary redesign`
      );
    } finally {
      setFixLoading(false);
    }
  }

  async function handleCopyPrompt() {
    if (!fixPrompt) return;

    try {
      await navigator.clipboard.writeText(fixPrompt);
      setFixCopied(true);
    } catch {
      setFixCopied(false);
    }
  }

  function handleCloseFixModal() {
    setFixModalOpen(false);
    setFixCopied(false);
  }

  if (auditError) {
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

          <h1 className="text-2xl font-semibold">UX SCAN+ results</h1>
          <p className="mt-2 text-sm text-destructive">
            Audit could not be completed.
          </p>

          <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-6">
            {auditError}
          </pre>
        </div>
      </main>
    );
  }

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
                href={initialUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {initialUrl}
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
                        Violations: {auditData?.a11y.violationsCount ?? 0}
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
                          disabled={synthLoading || !auditData}
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

                          <div>
                            <div className="font-medium">Quick wins</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Small changes that can improve usability quickly.
                            </div>

                            <ul className="mt-2 rounded-md border bg-muted/10 px-4 text-muted-foreground">
                              {synth.quickWins.map((item, index) => (
                                <QuickWinRow
                                  key={`quickwin-${index}`}
                                  text={item}
                                  onGenerateFix={() =>
                                    void handleGenerateFix(item)
                                  }
                                />
                              ))}
                            </ul>
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

                            {showFeedbackBanner && (
                              <div className="mt-4 flex items-center gap-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                <span className="text-base">ℹ</span>
                                <span>
                                  Help improve this audit. Hover or tap any
                                  feedback point to rate it. The AI learns from
                                  every response.
                                </span>
                              </div>
                            )}

                            <SectionList
                              title="Shared issues"
                              items={summaryShared}
                              emptyText="No shared issues called out."
                              feedbackType="summary"
                            />
                          </div>

                          <div>
                            <div className="font-medium">Top risks</div>
                            <ul className="mt-2 space-y-2 text-muted-foreground">
                              {synth.topRisks.map((item, index) => (
                                <FeedbackRow
                                  key={`risk-${index}`}
                                  text={item}
                                  type="risk"
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
                  {screenshots &&
                  (screenshots.desktop ||
                    screenshots.mobile ||
                    screenshots.folded) ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Screenshots</CardTitle>
                        <CardDescription>
                          Captured page snapshots for quick visual inspection.
                        </CardDescription>
                      </CardHeader>

                      <CardContent>
                        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                          {screenshots.desktop && (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                Desktop, above the fold
                              </div>
                              <div className="rounded-md border bg-muted/20 p-2">
                                <img
                                  src={screenshots.desktop}
                                  alt="Desktop screenshot"
                                  className="h-[220px] w-full rounded object-contain"
                                />
                              </div>
                            </div>
                          )}

                          {screenshots.mobile && (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                Mobile, above the fold
                              </div>
                              <div className="rounded-md border bg-muted/20 p-2">
                                <img
                                  src={screenshots.mobile}
                                  alt="Mobile screenshot"
                                  className="mx-auto h-[420px] w-auto rounded object-contain"
                                />
                              </div>
                            </div>
                          )}

                          {screenshots.folded && (
                            <div className="space-y-2 lg:col-span-2">
                              <div className="text-xs text-muted-foreground">
                                Desktop, full page
                              </div>
                              <div className="rounded-md border bg-muted/20 p-2">
                                <img
                                  src={screenshots.folded}
                                  alt="Full page screenshot"
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
                        Violations: {auditData?.a11y.violationsCount ?? 0}
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

      <FixPromptModal
        open={fixModalOpen}
        issue={selectedFixIssue}
        prompt={fixPrompt}
        loading={fixLoading}
        copied={fixCopied}
        onClose={handleCloseFixModal}
        onCopy={() => void handleCopyPrompt()}
      />
    </main>
  );
}