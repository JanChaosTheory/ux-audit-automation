/**
 * Deterministic mock audit generator. Same inputs (url, feature, stage) always produce the same output.
 * No external APIs.
 */

export type AuditSummary = {
  overall_score: number;
  top_3_risks: string[];
  quick_wins: string[];
};

export type HeuristicIssue = {
  issue: string;
  severity: string;
  impact: string;
  fix: string;
};

export type HeuristicPillar = {
  name: string;
  score: number;
  issues: HeuristicIssue[];
};

export type HeuristicEvaluation = {
  pillars: HeuristicPillar[];
};

export type A11yFinding = {
  type: string;
  severity: string;
  fix: string;
};

export type Accessibility = {
  a11y_score: number;
  findings: A11yFinding[];
};

export type Priorities = {
  P0: string[];
  P1: string[];
  P2: string[];
};

export type JiraTicket = {
  title: string;
  background: string;
  problem: string;
  solution: string;
  acceptance_criteria: string[];
};

export type JiraTickets = {
  tickets: JiraTicket[];
};

export type MockAudit = {
  summary: AuditSummary;
  heuristic_evaluation: HeuristicEvaluation;
  accessibility: Accessibility;
  priorities: Priorities;
  jira_tickets: JiraTickets;
};

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seededPick<T>(seed: number, arr: T[], count: number): T[] {
  const out: T[] = [];
  const n = arr.length;
  for (let i = 0; i < count && i < n; i++) {
    const idx = (seed + i * 31) % n;
    out.push(arr[idx]);
  }
  return out;
}

function seededInt(seed: number, min: number, max: number): number {
  const range = max - min + 1;
  return min + (Math.abs(seed) % range);
}

const PILLAR_NAMES = [
  "Visibility of system status",
  "Match between system and real world",
  "User control and freedom",
  "Consistency and standards",
  "Error prevention",
  "Recognition rather than recall",
  "Flexibility and efficiency of use",
];

const RISK_POOL = [
  "Critical actions lack confirmation; users can lose work.",
  "Error messages are technical and not user-friendly.",
  "No clear way to undo or recover from mistakes.",
  "Key flows have poor mobile responsiveness.",
  "Inconsistent navigation across the feature.",
  "Loading states are missing or unclear.",
  "Form validation feedback is delayed or unclear.",
  "Accessibility barriers block keyboard and screen reader users.",
  "Content hierarchy and labels are confusing.",
  "No help or documentation in context.",
];

const QUICK_WIN_POOL = [
  "Add loading spinners to async actions.",
  "Improve button labels to be action-oriented.",
  "Add aria-labels to icon-only buttons.",
  "Increase touch targets to at least 44px.",
  "Add focus visible styles to interactive elements.",
  "Use consistent terminology in the UI.",
  "Add confirmation before destructive actions.",
  "Show success feedback after form submit.",
  "Improve contrast on secondary text.",
  "Add skip links for keyboard users.",
];

const HEURISTIC_ISSUES_POOL: HeuristicIssue[] = [
  { issue: "No loading indicator during submit", severity: "high", impact: "Users may resubmit or leave.", fix: "Add spinner or skeleton and disable submit until complete." },
  { issue: "Success state not clearly communicated", severity: "medium", impact: "Uncertainty about outcome.", fix: "Show clear success message and next step." },
  { issue: "Jargon in labels", severity: "low", impact: "New users confused.", fix: "Use plain language matching user vocabulary." },
  { issue: "No cancel or back on modal", severity: "high", impact: "Users feel trapped.", fix: "Add Cancel and ensure Escape closes." },
  { issue: "Inconsistent button order", severity: "medium", impact: "More misclicks.", fix: "Primary action right, secondary left; match platform." },
  { issue: "Destructive action without confirm", severity: "critical", impact: "Accidental data loss.", fix: "Add confirmation dialog with clear consequences." },
  { issue: "No autosave or draft", severity: "medium", impact: "Lost work on refresh.", fix: "Persist draft locally or autosave." },
  { issue: "Dense form with no grouping", severity: "low", impact: "Cognitive overload.", fix: "Group related fields and add headings." },
  { issue: "Shortcuts not discoverable", severity: "low", impact: "Power users miss efficiency.", fix: "Add tooltip or help with shortcut list." },
  { issue: "Generic error message", severity: "high", impact: "User cannot self-serve.", fix: "Explain cause and next step." },
  { issue: "No focus management in modal", severity: "medium", impact: "Keyboard users lose context.", fix: "Trap focus and return on close." },
  { issue: "Placeholder used as label", severity: "medium", impact: "A11y and clarity issues.", fix: "Use visible labels; placeholder optional hint." },
  { issue: "Infinite scroll with no landmark", severity: "low", impact: "Screen reader navigation harder.", fix: "Add region/label and optional load more." },
  { issue: "Critical info only in tooltip", severity: "high", impact: "Mobile and a11y users miss it.", fix: "Surface essential info in main content." },
  { issue: "No recovery path after error", severity: "high", impact: "Dead end for users.", fix: "Provide retry, undo, or support link." },
];

const A11Y_FINDINGS_POOL: A11yFinding[] = [
  { type: "Color contrast", severity: "high", fix: "Increase contrast to at least 4.5:1 for text." },
  { type: "Focus indicator", severity: "medium", fix: "Add visible focus ring (2px outline)." },
  { type: "Missing alt text", severity: "high", fix: "Add descriptive alt for meaningful images." },
  { type: "Form labels", severity: "medium", fix: "Associate every input with a visible label." },
  { type: "Heading order", severity: "low", fix: "Use logical heading levels (h1 → h2 → h3)." },
  { type: "Keyboard trap", severity: "critical", fix: "Ensure focus can leave modal and focus is restored." },
  { type: "ARIA misuse", severity: "medium", fix: "Use correct roles and avoid redundant ARIA." },
  { type: "Link purpose", severity: "low", fix: "Use descriptive link text instead of 'click here'." },
  { type: "Touch target size", severity: "medium", fix: "Ensure targets at least 44×44px." },
  { type: "Skip link", severity: "low", fix: "Add skip to main content for keyboard users." },
];

const JIRA_TITLE_POOL = [
  "Improve loading and feedback on submit",
  "Add confirmation for destructive actions",
  "Fix color contrast in secondary text",
  "Add visible focus indicators",
  "Improve error messages and recovery",
  "Associate form labels with inputs",
  "Add skip link for keyboard users",
  "Fix focus trap in modal",
  "Improve touch target sizes",
  "Use plain language in labels",
];

const JIRA_BACKGROUND_POOL = [
  "Users reported confusion during the main flow.",
  "Accessibility audit identified barriers.",
  "Support tickets indicate repeated errors.",
  "Heuristic review flagged this as high risk.",
];

const JIRA_PROBLEM_POOL = [
  "Users cannot tell if an action succeeded or what to do next.",
  "Critical actions can be triggered by mistake with no way to undo.",
  "Some users cannot access the feature with keyboard or assistive tech.",
  "Error messages do not help users resolve issues.",
];

const JIRA_SOLUTION_POOL = [
  "Add clear loading and success states and disable double submit.",
  "Introduce a confirmation step and optional undo where feasible.",
  "Implement focus management, ARIA, and keyboard support.",
  "Replace generic errors with specific, actionable messages.",
];

const ACC_CRITERIA_POOL = [
  "Loading state visible within 200ms.",
  "User can cancel before action is committed.",
  "All interactive elements focusable and visible on focus.",
  "Error message includes cause and next step.",
  "Contrast ratio meets WCAG AA.",
  "No focus trap; Escape closes and restores focus.",
];

function pickIssues(seed: number, count: number): HeuristicIssue[] {
  const indexes: number[] = [];
  const n = HEURISTIC_ISSUES_POOL.length;
  for (let i = 0; i < count; i++) {
    indexes.push((seed + i * 17 + (seed >> 2)) % n);
  }
  return [...new Set(indexes)].slice(0, count).map((i) => HEURISTIC_ISSUES_POOL[i]);
}

function pickA11y(seed: number, count: number): A11yFinding[] {
  const indexes: number[] = [];
  const n = A11Y_FINDINGS_POOL.length;
  for (let i = 0; i < count; i++) {
    indexes.push((seed + i * 13) % n);
  }
  return [...new Set(indexes)].slice(0, count).map((i) => A11Y_FINDINGS_POOL[i]);
}

function generateJiraTicket(seed: number, index: number): JiraTicket {
  const t = JIRA_TITLE_POOL[(seed + index) % JIRA_TITLE_POOL.length];
  const b = JIRA_BACKGROUND_POOL[(seed + index * 3) % JIRA_BACKGROUND_POOL.length];
  const p = JIRA_PROBLEM_POOL[(seed + index * 5) % JIRA_PROBLEM_POOL.length];
  const s = JIRA_SOLUTION_POOL[(seed + index * 7) % JIRA_SOLUTION_POOL.length];
  const acCount = 2 + (seed + index) % 3;
  const ac: string[] = [];
  for (let i = 0; i < acCount; i++) {
    ac.push(ACC_CRITERIA_POOL[(seed + index * 11 + i) % ACC_CRITERIA_POOL.length]);
  }
  return { title: t, background: b, problem: p, solution: s, acceptance_criteria: ac };
}

export function generateMockAudit(url: string, feature: string, stage: string): MockAudit {
  const input = `${url}|${feature}|${stage}`;
  const h = simpleHash(input);
  const s1 = simpleHash(url || "u");
  const s2 = simpleHash(feature || "f");
  const s3 = simpleHash(stage || "s");

  const overall_score = 1 + (h % 5);
  const a11y_score = 1 + ((h >> 4) % 5);
  const top_3_risks = seededPick(s1, RISK_POOL, 3);
  const quick_wins = seededPick(s2, QUICK_WIN_POOL, 3);

  const pillars: HeuristicPillar[] = PILLAR_NAMES.map((name, i) => ({
    name,
    score: 1 + ((h + i * 7 + s1) % 5),
    issues: pickIssues(s2 + i * 19, 2 + (s3 + i) % 3),
  }));

  const a11yCount = 4 + (h % 5);
  const findings = pickA11y(s1 + s2, a11yCount);

  const allIssues = pillars.flatMap((p) => p.issues);
  const p0Count = Math.min(2, Math.floor(allIssues.length / 4));
  const p1Count = Math.min(4, Math.floor(allIssues.length / 2));
  const P0 = allIssues.filter((x) => x.severity === "critical").map((x) => x.issue).slice(0, p0Count);
  const remaining = allIssues.filter((x) => x.severity !== "critical");
  const P1 = remaining.filter((x) => x.severity === "high").map((x) => x.issue).slice(0, p1Count);
  const P2 = remaining.filter((x) => x.severity === "medium" || x.severity === "low").map((x) => x.issue).slice(0, 6);
  if (P0.length === 0 && allIssues.length > 0) P0.push(allIssues[0].issue);
  if (P1.length === 0 && remaining.length > 0) P1.push(remaining[0].issue);

  const ticketCount = 5 + (h % 6);
  const tickets: JiraTicket[] = [];
  for (let i = 0; i < ticketCount; i++) {
    tickets.push(generateJiraTicket(s1 + s2 + s3, i));
  }

  return {
    summary: { overall_score, top_3_risks, quick_wins },
    heuristic_evaluation: { pillars },
    accessibility: { a11y_score, findings },
    priorities: { P0, P1, P2 },
    jira_tickets: { tickets },
  };
}
