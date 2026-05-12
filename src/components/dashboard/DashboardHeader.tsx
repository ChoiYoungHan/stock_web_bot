export function DashboardHeader() {
  return (
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">실시간 스캐너</p>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">주식 분석 대시보드</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-muted">
        모바일 퍼스트 레이아웃과 다크 테마로 상위 유니버스를 5분마다 갱신합니다. 카드를 눌러 차트·재무 상세로
        이동할 수 있습니다.
      </p>
    </header>
  );
}
