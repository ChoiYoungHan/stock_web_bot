"use client";

interface AIEngineStripProps {
  technical: string;
  fundamental: string;
  loadingTechnical: boolean;
  loadingFundamental: boolean;
}

export function AIEngineStrip({
  technical,
  fundamental,
  loadingTechnical,
  loadingFundamental,
}: AIEngineStripProps) {
  return (
    <section aria-label="분석 엔진" className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">분석 엔진</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-card-border bg-[#1a1a1a] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">기술적 분석</h3>
          {loadingTechnical ? (
            <p className="mt-2 h-16 animate-pulse rounded bg-card-border/40" />
          ) : (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {technical || "—"}
            </p>
          )}
        </article>
        <article className="rounded-xl border border-card-border bg-[#1a1a1a] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">기본적 분석</h3>
          {loadingFundamental ? (
            <p className="mt-2 h-16 animate-pulse rounded bg-card-border/40" />
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{fundamental || "—"}</p>
          )}
        </article>
      </div>
    </section>
  );
}
