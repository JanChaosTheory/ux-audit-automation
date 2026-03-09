import type { MockAudit } from "@/lib/mock-audit";

/**
 * Decision Complexity Index: 1–5.
 * +1 if total issues >= 12, +1 if P0 >= 3, +1 if any 2 pillars have score <= 2, +1 if post-dev. Clamp to 5.
 */
export function computeDecisionComplexityIndex(
  audit: MockAudit,
  stage: string
): number {
  let score = 1;

  const totalIssues =
    audit.heuristic_evaluation.pillars.reduce(
      (sum, p) => sum + p.issues.length,
      0
    ) + audit.accessibility.findings.length;
  if (totalIssues >= 12) score += 1;

  if (audit.priorities.P0.length >= 3) score += 1;

  const pillarsWithLowScore = audit.heuristic_evaluation.pillars.filter(
    (p) => p.score <= 2
  );
  if (pillarsWithLowScore.length >= 2) score += 1;

  if (stage === "post-dev") score += 1;

  return Math.min(5, Math.max(1, score));
}

/**
 * One-sentence explanation for the Decision Complexity Index.
 */
export function getDecisionComplexityExplanation(
  score: number,
  audit: MockAudit,
  stage: string
): string {
  const reasons: string[] = [];
  const totalIssues =
    audit.heuristic_evaluation.pillars.reduce(
      (sum, p) => sum + p.issues.length,
      0
    ) + audit.accessibility.findings.length;
  if (totalIssues >= 12) reasons.push("many issues");
  if (audit.priorities.P0.length >= 3) reasons.push("multiple P0 items");
  const lowPillars = audit.heuristic_evaluation.pillars.filter(
    (p) => p.score <= 2
  ).length;
  if (lowPillars >= 2) reasons.push("weak heuristic pillars");
  if (stage === "post-dev") reasons.push("post-dev scope");
  if (reasons.length === 0) return "Complexity is low; few factors add scope.";
  return `Complexity driven by ${reasons.join(", ")}.`;
}

function getP0Severities(audit: MockAudit): string[] {
  const severities: string[] = [];
  for (const issueText of audit.priorities.P0) {
    for (const pillar of audit.heuristic_evaluation.pillars) {
      const found = pillar.issues.find((i) => i.issue === issueText);
      if (found) {
        severities.push(found.severity);
        break;
      }
    }
  }
  return severities;
}

export type ReleaseRiskLevel = "Low" | "Medium" | "High";

/**
 * Release Risk: High if any P0 severity is "High" or a11y_score <= 2;
 * Medium if overall_score <= 3 or P0 count >= 2; else Low.
 */
export function computeReleaseRiskLevel(audit: MockAudit): ReleaseRiskLevel {
  const p0Severities = getP0Severities(audit);
  const hasHighP0 = p0Severities.some(
    (s) => s.toLowerCase() === "high" || s.toLowerCase() === "critical"
  );
  if (hasHighP0 || audit.accessibility.a11y_score <= 2) return "High";
  if (audit.summary.overall_score <= 3 || audit.priorities.P0.length >= 2)
    return "Medium";
  return "Low";
}

/**
 * Audit Confidence: 55–90% from input completeness.
 * Start 60; +10 url valid, +10 feature >= 80 chars, +5 post-dev, +5 a11y findings >= 3. Clamp 55–90.
 */
export function computeAuditConfidence(
  audit: MockAudit,
  url: string,
  feature: string,
  stage: string
): number {
  let pct = 60;

  if (url.trim().length > 0) {
    try {
      new URL(url.trim());
      pct += 10;
    } catch {
      // invalid url, no bonus
    }
  }

  if (feature.trim().length >= 80) pct += 10;

  if (stage === "post-dev") pct += 5;

  if (audit.accessibility.findings.length >= 3) pct += 5;

  return Math.min(90, Math.max(55, pct));
}

export type ShipRecommendation = "Do not ship" | "Ship with guardrails" | "Safe to ship";

/**
 * Ship recommendation from release risk: High → Do not ship, Medium → Ship with guardrails, Low → Safe to ship.
 */
export function getShipRecommendation(releaseRisk: ReleaseRiskLevel): ShipRecommendation {
  if (releaseRisk === "High") return "Do not ship";
  if (releaseRisk === "Medium") return "Ship with guardrails";
  return "Safe to ship";
}

/**
 * One-sentence rationale for the ship recommendation, mentioning the main driver.
 */
export function getShipRationale(audit: MockAudit, releaseRisk: ReleaseRiskLevel): string {
  if (releaseRisk === "High") {
    const p0Severities = getP0Severities(audit);
    const hasHighP0 = p0Severities.some(
      (s) => s.toLowerCase() === "high" || s.toLowerCase() === "critical"
    );
    const lowA11y = audit.accessibility.a11y_score <= 2;
    if (hasHighP0 && lowA11y)
      return "High risk due to P0 issues and low a11y score.";
    if (hasHighP0) return "High risk due to P0 issues.";
    return "High risk due to low a11y score.";
  }
  if (releaseRisk === "Medium") {
    const fromScore = audit.summary.overall_score <= 3;
    const fromP0 = audit.priorities.P0.length >= 2;
    if (fromScore && fromP0)
      return "Medium risk from overall score and multiple P0 items.";
    if (fromP0) return "Medium risk from multiple P0 items.";
    return "Medium risk from overall score.";
  }
  return "Low risk; no critical blockers.";
}
