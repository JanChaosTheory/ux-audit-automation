// components/ui/ViolationCard.tsx
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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

function getImpactLabel(impact: string | null) {
  return (impact ?? "unknown").toLowerCase();
}

function getImpactVariant(
  impact: string | null
): "default" | "secondary" | "destructive" {
  const value = (impact ?? "").toLowerCase();

  if (value === "critical") return "destructive";
  if (value === "serious") return "destructive";
  if (value === "moderate") return "default";
  if (value === "minor") return "secondary";

  return "secondary";
}

export function ViolationCard({ v }: { v: A11yTopViolation }) {
  return (
    <Card className="transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold">
            {v.id}
          </CardTitle>

          <Badge variant={getImpactVariant(v.impact)}>
            {getImpactLabel(v.impact)}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground mt-1">
          {v.help}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground">
            Nodes affected: {v.nodes}
          </div>

          <a
            href={v.helpUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            View rule →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}