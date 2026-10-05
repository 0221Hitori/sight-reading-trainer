import { describe, expect, it } from 'vitest';
import { AnswerChecker, SessionScore } from '@/music/scoring';

describe('AnswerChecker', () => {
  it('accepts a single pitch class and rejects a wrong one', () => {
    const correct = AnswerChecker.applyPitchClass([4], [], 4);
    expect(correct.grade?.correct).toBe(true);
    const wrong = AnswerChecker.applyPitchClass([4], [], 5);
    expect(wrong.grade).toEqual({ correct: false, reason: 'wrong', wrongPitchClass: 5 });
  });

  it('waits for every chord tone and ignores duplicates', () => {
    const first = AnswerChecker.applyPitchClass([0, 4, 7], [], 7);
    expect(first.grade).toBeNull();
    const duplicate = AnswerChecker.applyPitchClass([0, 4, 7], first.entered, 7);
    expect(duplicate.grade).toBeNull();
    expect(duplicate.entered).toEqual([7]);
    const second = AnswerChecker.applyPitchClass([0, 4, 7], duplicate.entered, 0);
    expect(second.grade).toBeNull();
    const third = AnswerChecker.applyPitchClass([0, 4, 7], second.entered, 4);
    expect(third.grade?.reason).toBe('match');
  });

  it('fails a chord as soon as an outside pitch class appears', () => {
    const partial = AnswerChecker.applyPitchClass([0, 4], [], 0);
    const failed = AnswerChecker.applyPitchClass([0, 4], partial.entered, 2);
    expect(failed.grade?.correct).toBe(false);
  });

  it('tracks streaks, accuracy, and misses', () => {
    let score = SessionScore.empty();
    score = score.record({ correct: true, reason: 'match', wrongPitchClass: null }, 800, null);
    score = score.record({ correct: true, reason: 'match', wrongPitchClass: null }, 1200, null);
    score = score.record(
      { correct: false, reason: 'wrong', wrongPitchClass: 2 },
      500,
      { expectedLabel: 'E4', playedLabel: 'D', noteNames: ['E'], clefLabel: '高音' },
    );
    expect(score.streak).toBe(0);
    expect(score.bestStreak).toBe(2);
    expect(score.accuracy).toBeCloseTo(2 / 3);
    expect(score.misses).toHaveLength(1);
    expect(SessionScore.formatAccuracy(score.accuracy)).toBe('67%');
    expect(AnswerChecker.timeout().reason).toBe('timeout');
    expect(AnswerChecker.reveal().correct).toBe(false);
  });
});
