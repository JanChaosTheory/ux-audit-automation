"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ViolationCard } from "@/components/ui/ViolationCard";

type Violation = {
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
    topViolations: Violation[];
  };
};

type SynthResponse = {
  summary: string[];
  quickWins: string[];
  topRisks: string[];
  decision: string;
  decisionReason: string;
};

export function ResultsClient({
  initialUrl,
  initialContext,
}: {
  initialUrl: string;
  initialContext: string;
}) {
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [synth, setSynth] = useState<SynthResponse | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [loadingSynth, setLoadingSynth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    async function runAudit() {
      try {
        const params = new URLSearchParams({
          url: initialUrl,
          context: initialContext,
        });

        const res = await fetch(`/api/audit?${params}`);
        const json = await res.json();

        setAudit(json);
      } catch (e: any) {
        setError(String(e));
      } finally {
        setLoadingAudit(false);
      }
    }

    runAudit();
  }, [initialUrl, initialContext]);

  useEffect(() => {
    if (!audit) return;

    async function runSynth() {
      try {
        setLoadingSynth(true);

        const res = await fetch("/api/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: audit.url,
            context: initialContext,
            a11y: audit.a11y,
          }),
        });

        const json = await res.json();
        setSynth(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSynth(false);
      }
    }

    runSynth();
  }, [audit, initialContext]);

  async function generateFix(issue: string) {
    const res = await fetch("/api/fix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        issue,
        url: audit?.url,
        context: initialContext,
      }),
    });

    const json = await res.json();
    alert(json.prompt);
  }

  if (error) {
    return (
      <main className="p-10">
        <h1 className="text-xl font-semibold">Audit error</h1>
        <pre className="mt-4">{error}</pre>
      </main>
    );
  }

  if (loadingAudit) {
    return (
      <main className="p-10">
        <h1 className="text-xl font-semibold">Running audit…</h1>
      </main>
    );
  }

  if (!audit) return null;

  const score = 100 - audit.a11y.violationsCount * 4;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/audit" className="text-sm text-muted-foreground">
          ← New audit
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-6">Audit results</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Accessibility score</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="text-4xl font-bold">{score}/100</div>
          <div className="text-sm text-muted-foreground">
            Violations: {audit.a11y.violationsCount}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
          <TabsTrigger value="a11y">Accessibility</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6 mt-6">
          {loadingSynth && <p>Generating UX analysis…</p>}

          {synth && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Decision</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>
                    {synth.decision}: {synth.decisionReason}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick wins</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {synth.quickWins.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border-b pb-2"
                    >
                      <span>{w}</span>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateFix(w)}
                      >
                        Generate fix
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top risks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {synth.topRisks.map((r, i) => (
                    <div key={i}>{r}</div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="screenshots" className="mt-6 space-y-6">
          {audit.screenshots?.desktop && (
            <Card>
              <CardHeader>
                <CardTitle>Desktop screenshot</CardTitle>
              </CardHeader>

              <CardContent>
                <img
                  src={audit.screenshots.desktop}
                  className="rounded border"
                />
              </CardContent>
            </Card>
          )}

          {audit.screenshots?.mobile && (
            <Card>
              <CardHeader>
                <CardTitle>Mobile screenshot</CardTitle>
              </CardHeader>

              <CardContent>
                <img
                  src={audit.screenshots.mobile}
                  className="rounded border max-w-xs"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="a11y" className="mt-6 space-y-4">
          {audit.a11y.topViolations.map((v) => (
            <ViolationCard key={v.id} v={v} />
          ))}
        </TabsContent>
      </Tabs>
    </main>
  );
}