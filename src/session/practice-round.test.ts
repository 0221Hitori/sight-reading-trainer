import { describe, expect, it } from 'vitest';
import { MusicTheory } from '@/music/theory';
import { PracticePresets } from '@/music/presets';
import { RandomSource } from '@/music/random';
import { PracticeRound } from '@/session/practice-round';
import type { PracticeSettings } from '@/music/types';

describe('PracticeRound', () => {
  it('accepts a note, rejects a wrong one, and ends the round at the session length', () => {
    const settings = { ...PracticePresets.apply('beginner', false), sessionLength: 2 };
    const rng = RandomSource.mulberry32(9);
    const started = PracticeRound.create(settings, rng, 1_000);
    const target = MusicTheory.pitchClass(started.exercise.notes[0]!.midi);
    const correct = PracticeRound.input(started, settings, target, 1_400);
    expect(correct.effect).toBe('correct');
    expect(correct.snapshot.score.streak).toBe(1);
    expect(correct.snapshot.score.averageResponseMs).toBe(400);

    const second = PracticeRound.advance(correct.snapshot, settings, rng, 2_000);
    expect(second.phase).toBe('question');
    const wrongPitch = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].find(
      (pitchClass) => pitchClass !== MusicTheory.pitchClass(second.exercise.notes[0]!.midi),
    )!;
    const missed = PracticeRound.input(second, settings, wrongPitch, 2_500);
    expect(missed.effect).toBe('wrong');
    expect(missed.miss?.playedLabel).not.toBe('超时');
    expect(missed.snapshot.score.streak).toBe(0);
    expect(missed.snapshot.score.bestStreak).toBe(1);

    const summary = PracticeRound.advance(missed.snapshot, settings, rng, 3_000);
    expect(summary.phase).toBe('summary');
    expect(PracticeRound.input(summary, settings, 0, 3_100).effect).toBe('none');
  });

  it('collects every chord tone before resolving, and ignores a repeated key', () => {
    const settings: PracticeSettings = {
      ...PracticePresets.apply('advanced', true),
      chordSizeMin: 2,
      chordSizeMax: 2,
      chromaticProbability: 0,
      timed: false,
    };
    const round = PracticeRound.create(settings, RandomSource.mulberry32(21), 0);
    expect(round.exercise.notes).toHaveLength(2);
    const [first, second] = round.exercise.notes.map((note) => MusicTheory.pitchClass(note.midi));
    const partial = PracticeRound.input(round, settings, first!, 100);
    expect(partial.effect).toBe('partial');
    expect(partial.snapshot.phase).toBe('question');
    const duplicate = PracticeRound.input(partial.snapshot, settings, first!, 120);
    expect(duplicate.effect).toBe('none');
    expect(duplicate.snapshot).toBe(partial.snapshot);
    const done = PracticeRound.input(partial.snapshot, settings, second!, 200);
    expect(done.effect).toBe('correct');
    expect(done.snapshot.score.correct).toBe(1);
  });

  it('records a timeout without a played pitch', () => {
    const settings = PracticePresets.apply('easy', true);
    const round = PracticeRound.create(settings, () => 0.2, 50);
    const timedOut = PracticeRound.timeout(round, settings, 8_050);
    expect(timedOut.effect).toBe('timeout');
    expect(timedOut.miss?.playedLabel).toBe('超时');
    expect(timedOut.snapshot.score.attempts).toBe(1);
    expect(timedOut.snapshot.grade?.correct).toBe(false);
  });
});