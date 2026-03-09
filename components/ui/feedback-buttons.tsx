"use client";

import * as React from "react";

type Props = {
  text: string;
  type: "summary" | "risk" | "quickwin";
};

export function FeedbackRow({ text, type }: Props) {
  const [vote, setVote] = React.useState<"up" | "down" | null>(null);
  const [hover, setHover] = React.useState(false);

  async function sendFeedback(direction: "up" | "down") {
    setVote(direction);

    await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        type,
        vote: direction,
      }),
    });
  }

  const rowStyles = [
    "rounded-md px-2 py-1.5 transition-colors",
    "flex items-start justify-between gap-3",
    "group",
    vote === "up" ? "bg-green-500/5 text-green-600" : "",
    vote === "down" ? "bg-red-500/5 text-red-600" : "",
    hover && !vote ? "bg-muted/50" : "",
  ].join(" ");

  return (
    <li
      className={rowStyles}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="flex-1">{text}</span>

      <div
        className={[
          "flex shrink-0 gap-2 text-sm transition-opacity",
          hover || vote ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => sendFeedback("up")}
          className="hover:text-green-600"
          aria-label="Mark as useful"
        >
          ✓
        </button>

        <button
          type="button"
          onClick={() => sendFeedback("down")}
          className="hover:text-red-600"
          aria-label="Mark as not useful"
        >
          ✕
        </button>
      </div>
    </li>
  );
}