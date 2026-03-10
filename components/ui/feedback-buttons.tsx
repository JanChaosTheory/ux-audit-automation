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
    const newVote = vote === direction ? null : direction;

    setVote(newVote);

    await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        type,
        vote: newVote,
      }),
    });
  }

  const rowStyles = [
    "rounded-md px-2 py-1.5 transition-colors",
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
      <div className="flex items-start gap-2">
        <span className="mt-1 shrink-0 text-base leading-none text-muted-foreground">
          •
        </span>

        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <span className="flex-1 text-sm">{text}</span>

          <div
            className={[
              "flex shrink-0 gap-2 text-sm transition-opacity",
              hover || vote ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            {vote === null ? (
              <>
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
              </>
            ) : vote === "up" ? (
              <button
                type="button"
                onClick={() => sendFeedback("up")}
                className="hover:text-green-600"
                aria-label="Remove useful mark"
              >
                ✓
              </button>
            ) : (
              <button
                type="button"
                onClick={() => sendFeedback("down")}
                className="hover:text-red-600"
                aria-label="Remove not useful mark"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}