import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          UX Audit Automation
        </h1>
        <p className="max-w-md text-muted-foreground">
          Run structured UX audits with heuristic evaluation, accessibility checks, and prioritized fixes.
        </p>
        <Button asChild size="lg">
          <Link href="/audit">Start Audit</Link>
        </Button>
      </main>
    </div>
  );
}
