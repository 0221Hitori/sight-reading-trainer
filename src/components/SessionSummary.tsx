import type { LifetimeStats } from '@/music/types';
import { SessionScore } from '@/music/scoring';
import { Button } from '@/components/ui/button';

interface SessionSummaryProps {
  score: SessionScore;
  lifetime: LifetimeStats;
  onRestart: () => void;
}

/** 本轮小结。这里的错题只属于这一轮；刷新后仍在的是 LifetimeStats.recentMisses。 */
export function SessionSummary({ score, lifetime, onRestart }: SessionSummaryProps) {
  return (
    <div className="flex flex-col gap-4 py-6" data-testid="summary">
      <p className="text-sm tracking-[0.18em] text-muted-foreground uppercase">本轮结束</p>
      <h2 className="font-display text-4xl">{SessionScore.formatAccuracy(score.accuracy)}</h2>
      <p className="text-muted-foreground">
        {score.correct} / {score.attempts} 题正确 · 最佳连对 {score.bestStreak} · 平均{' '}
        {SessionScore.formatMs(score.averageResponseMs)}
      </p>
      {score.misses.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {score.misses.map((miss, index) => (
            <li key={`${miss.expectedLabel}-${index}`}>
              {miss.clefLabel}谱表 {miss.expectedLabel}
              <span className="text-muted-foreground"> · 你答了 {miss.playedLabel}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>这一轮没有错题。</p>
      )}
      <p className="text-sm text-muted-foreground">
        全部练习累计 {lifetime.totalAttempts} 题，最佳连对 {lifetime.bestStreak}，完成 {lifetime.sessionsCompleted} 轮。
      </p>
      <div>
        <Button type="button" onClick={onRestart}>
          再练一轮
        </Button>
      </div>
    </div>
  );
}
