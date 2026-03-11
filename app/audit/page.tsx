"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuditPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    const form = e.currentTarget;

    const url = (form.elements.namedItem("url") as HTMLInputElement | null)
      ?.value?.trim();

    const context = (
      form.elements.namedItem("context") as HTMLTextAreaElement | null
    )?.value?.trim();

    if (!url) return;

    setLoading(true);

    const params = new URLSearchParams({
      url,
      context: context || "",
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    router.push(`/results?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </Link>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold font-fraunces">UX SCAN+</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered UX and accessibility audits in minutes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New audit</CardTitle>
            <CardDescription>
              Enter a page URL to run an automated UX, usability, and
              accessibility audit.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="url">Page URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://example.com/page"
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="context">Audit context (optional)</Label>
                <Textarea
                  id="context"
                  name="context"
                  placeholder="Example: Reviewing a checkout page. Focus on CTA visibility, form clarity, error states, and mobile usability."
                  rows={4}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Starting audit...
                  </span>
                ) : (
                  "Run audit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}