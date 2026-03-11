import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight font-fraunces">UX SCAN+</h1>

        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          AI-powered UX and accessibility audits in minutes.
        </p>

        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Enter any URL and get a structured report with screenshots,
          accessibility findings, usability risks, and AI-generated
          improvement suggestions.
        </p>

        <div className="mt-8">
          <Link href="/audit">
            <Button size="lg" className="bg-[#16a34a] hover:bg-[#15803d] text-white">Run UX scan</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}