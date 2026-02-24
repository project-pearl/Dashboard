"use client";

import { useState, useEffect } from "react";
import { getSessionQuote, type MissionQuote as MQ } from "@/lib/missionQuotes";

interface Props {
  role: string;
  variant?: "dark" | "light";
}

export default function MissionQuote({ role, variant = "dark" }: Props) {
  const [quote, setQuote] = useState<MQ | null>(null);

  useEffect(() => {
    setQuote(getSessionQuote(role));
  }, [role]);

  if (!quote) return null;

  if (variant === "dark") {
    return (
      <div className="bg-slate-900 py-6">
        <blockquote className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-lg sm:text-xl font-medium text-white italic leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <cite className="mt-2 block text-sm text-slate-400 not-italic">
            &mdash; {quote.attribution}
          </cite>
        </blockquote>
      </div>
    );
  }

  return (
    <div className="bg-white/80 border border-slate-200 rounded-lg px-6 py-4 flex items-start gap-4">
      <div className="w-1 self-stretch rounded-full bg-emerald-400 shrink-0" />
      <blockquote className="min-w-0">
        <p className="text-sm sm:text-base text-slate-700 italic leading-relaxed">
          &ldquo;{quote.text}&rdquo;
        </p>
        <cite className="mt-1 block text-xs text-slate-400 not-italic">
          &mdash; {quote.attribution}
        </cite>
      </blockquote>
    </div>
  );
}
