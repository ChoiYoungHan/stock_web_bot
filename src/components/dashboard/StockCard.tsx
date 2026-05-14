"use client";

import Link from "next/link";
import type { ScannerStock } from "@/types/stock";
import { signalLabel } from "@/lib/scanner-labels";
import { quantCaptureHashtags } from "@/utils/analysis";

interface StockCardProps {
  stock: ScannerStock;
}

function formatPrice(stock: ScannerStock): string {
  if (stock.market === "domestic" || stock.market === "crypto") {
    return `${stock.price.toLocaleString("ko-KR")}원`;
  }
  return `$${stock.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StockCard({ stock }: StockCardProps) {
  const up = stock.changePercent >= 0;
  const href = `/stock/${encodeURIComponent(stock.symbol)}?market=${stock.market}`;
  const q = stock.quant;
  const captureTags = q ? quantCaptureHashtags(q.flags) : [];

  return (
    <Link
      href={href}
      className="group flex min-h-[9.5rem] flex-col rounded-xl border border-card-border bg-card p-4 shadow-sm transition hover:border-accent/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{stock.symbol}</p>
          <h3 className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug text-foreground group-hover:text-accent">
            {stock.name}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
              up ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative"
            }`}
          >
            {up ? "+" : ""}
            {stock.changePercent.toFixed(2)}%
          </span>
          {q != null && (
            <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
              {q.score}점 · {q.confidence}%
            </span>
          )}
        </div>
      </div>
      <p className="mt-3 font-mono text-lg font-semibold tabular-nums">{formatPrice(stock)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {stock.signals.map((s) => (
          <span
            key={s}
            className="rounded border border-card-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted"
          >
            {signalLabel(s)}
          </span>
        ))}
      </div>
      {captureTags.length > 0 && (
        <p className="mt-2 text-[11px] leading-snug text-foreground/90">
          <span className="text-muted">포착 사유 </span>
          {captureTags.map((tag) => (
            <span key={tag} className="mr-1.5 font-medium text-accent">
              {tag}
            </span>
          ))}
        </p>
      )}
      <p className="mt-auto pt-3 text-xs leading-relaxed text-muted line-clamp-2">{stock.signalSummary}</p>
    </Link>
  );
}
