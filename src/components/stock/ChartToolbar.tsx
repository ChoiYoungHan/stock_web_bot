"use client";

interface ChartToolbarProps {
  magnetOn: boolean;
  trendToolOn: boolean;
  onToggleMagnet: () => void;
  onToggleTrend: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onOpenIndicators: () => void;
}

export function ChartToolbar({
  magnetOn,
  trendToolOn,
  onToggleMagnet,
  onToggleTrend,
  onZoomIn,
  onZoomOut,
  onFit,
  onOpenIndicators,
}: ChartToolbarProps) {
  const btn =
    "flex min-h-9 min-w-9 items-center justify-center rounded-md border border-card-border bg-[#0a0a0a] px-2 text-xs font-medium text-foreground transition hover:border-accent/50 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

  const toggle = (active: boolean) =>
    `${btn} ${active ? "border-accent/60 bg-accent/10 text-accent" : ""}`;

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-lg border border-card-border bg-[#1a1a1a] p-1.5"
      role="toolbar"
      aria-label="차트 도구"
    >
      <span className="hidden px-2 text-[10px] font-semibold uppercase tracking-wide text-muted sm:inline">
        TradingView 스타일
      </span>
      <div className="mx-1 hidden h-5 w-px bg-card-border sm:block" />
      <button type="button" className={btn} onClick={onZoomOut} title="축소">
        −
      </button>
      <button type="button" className={btn} onClick={onZoomIn} title="확대">
        +
      </button>
      <button type="button" className={btn} onClick={onFit} title="범위 맞춤">
        맞춤
      </button>
      <button type="button" className={btn} onClick={onOpenIndicators} title="지표 설정">
        지표 설정
      </button>
      <div className="mx-1 hidden h-5 w-px bg-card-border sm:block" />
      <button
        type="button"
        className={toggle(trendToolOn)}
        onClick={onToggleTrend}
        aria-pressed={trendToolOn}
        title="추세선"
      >
        추세선
      </button>
      <button
        type="button"
        className={toggle(magnetOn)}
        onClick={onToggleMagnet}
        aria-pressed={magnetOn}
        title="자석 OHLC"
      >
        자석
      </button>
    </div>
  );
}
