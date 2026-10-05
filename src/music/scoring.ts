import type { Grade, MissRecord } from '@/music/types';

/**
 * 把一串音级和谱上的音比较。八度被忽略，C♯ 与 D♭ 是同一个键。
 * 键盘、屏幕钢琴和 MIDI 都只调用这里，不要在输入处理里另写判分。
 */
export class AnswerChecker {
  static targetClasses(midis: readonly number[]): number[] {
    const classes: number[] = [];
    for (const midi of midis) {
      const pitchClass = ((midi % 12) + 12) % 12;
      if (!classes.includes(pitchClass)) classes.push(pitchClass);
    }
    return classes;
  }

  /**
   * 把新按下的音级并进尚未完成的答案。
   * 目标以外的音级立刻判错。重复按已确认的音级则忽略。
   * 只有每个目标音级都出现过才算对，顺序无关。
   */
  static applyPitchClass(
    target: readonly number[],
    entered: readonly number[],
    pitchClass: number,
  ): { entered: number[]; grade: Grade | null } {
    if (entered.includes(pitchClass)) {
      return { entered: [...entered], grade: null };
    }
    const next = [...entered, pitchClass];
    if (!target.includes(pitchClass)) {
      return {
        entered: next,
        grade: { correct: false, reason: 'wrong', wrongPitchClass: pitchClass },
      };
    }
    const complete = target.every((item) => next.includes(item));
    if (complete) {
      return { entered: next, grade: { correct: true, reason: 'match', wrongPitchClass: null } };
    }
    return { entered: next, grade: null };
  }

  static timeout(): Grade {
    return { correct: false, reason: 'timeout', wrongPitchClass: null };
  }

  static reveal(): Grade {
    return { correct: false, reason: 'reveal', wrongPitchClass: null };
  }
}

/** 本轮不可变记分。跨刷新的累计成绩在 ProgressStore。 */
export class SessionScore {
  readonly attempts: number;
  readonly correct: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly totalResponseMs: number;
  readonly misses: readonly MissRecord[];

  constructor(
    attempts = 0,
    correct = 0,
    streak = 0,
    bestStreak = 0,
    totalResponseMs = 0,
    misses: readonly MissRecord[] = [],
  ) {
    this.attempts = attempts;
    this.correct = correct;
    this.streak = streak;
    this.bestStreak = bestStreak;
    this.totalResponseMs = totalResponseMs;
    this.misses = misses;
  }

  static empty(): SessionScore {
    return new SessionScore();
  }

  record(grade: Grade, responseMs: number, miss: MissRecord | null): SessionScore {
    const streak = grade.correct ? this.streak + 1 : 0;
    return new SessionScore(
      this.attempts + 1,
      this.correct + (grade.correct ? 1 : 0),
      streak,
      Math.max(this.bestStreak, streak),
      this.totalResponseMs + Math.max(0, responseMs),
      miss ? [...this.misses, miss] : this.misses,
    );
  }

  get accuracy(): number {
    if (this.attempts === 0) return 0;
    return this.correct / this.attempts;
  }

  get averageResponseMs(): number {
    if (this.attempts === 0) return 0;
    return this.totalResponseMs / this.attempts;
  }

  static formatAccuracy(ratio: number): string {
    return `${Math.round(ratio * 100)}%`;
  }

  static formatMs(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    return `${(ms / 1000).toFixed(1)} 秒`;
  }
}
