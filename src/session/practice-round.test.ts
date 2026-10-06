import { describe, expect, it } from 'vitest';
import { MusicTheory } from '@/music/theory';
import { PracticePresets } from '@/music/presets';
import { RandomSource } from '@/music/random';
import { PracticeRound } from '@/session/practice-round';
import type { PracticeSettings } from '@/music/types';

describe('PracticeRound', () => {
  it('accepts a note, rejects a wrong one, and ends the round at the session length', () => {
    const settings = {
      ...PracticePresets.apply('beginner', false),
      sessionLength: 2,
      lineLengthMin: 1,
      lineLengthMax: 1,
    };
    const rng = RandomSource.mulberry32(9);
    const started = PracticeRound.create(settings, rng, 1_000);
    const target = MusicTheory.pitchClass(started.exercise.slots[0]!.notes[0]!.midi);
    const correct = PracticeRound.input(started, settings, target, 1_400);
    expect(correct.effect).toBe('correct');
    expect(correct.snapshot.score.streak).toBe(1);
    expect(correct.snapshot.score.averageResponseMs).toBe(400);

    const second = PracticeRound.advance(correct.snapshot, settings, rng, 2_000);
    expect(second.phase).toBe('question');
    const wrongPitch = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].find(
      (pitchClass) => pitchClass !== MusicTheory.pitchClass(second.exercise.slots[0]!.notes[0]!.midi),
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
      lineLengthMin: 1,
      lineLengthMax: 1,
      timed: false,
    };
    const round = PracticeRound.create(settings, RandomSource.mulberry32(21), 0);
    expect(round.exercise.slots[0]!.notes).toHaveLength(2);
    const [first, second] = round.exercise.slots[0]!.notes.map((note) => MusicTheory.pitchClass(note.midi));
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
    expect(PracticeRound.advanceDelay('timeout', settings)).toBeNull();
  });

  it('walks a line left to right, records a miss, and does not wait for the right key', () => {
    const settings = {
      ...PracticePresets.apply('beginner', false),
      lineLengthMin: 2,
      lineLengthMax: 2,
      sessionLength: 3,
      wrongAdvanceMs: 500,
    };
    const rng = RandomSource.mulberry32(9);
    const started = PracticeRound.create(settings, rng, 1_000);
    expect(started.exercise.slots).toHaveLength(2);
    expect(started.cursor).toBe(0);
    expect(started.marks).toEqual([null, null]);

    const firstPitch = MusicTheory.pitchClass(started.exercise.slots[0]!.notes[0]!.midi);
    const correct = PracticeRound.input(started, settings, firstPitch, 1_100);
    expect(correct.effect).toBe('correct');
    expect(correct.snapshot.cursor).toBe(0);
    expect(correct.snapshot.marks[0]?.correct).toBe(true);
    expect(PracticeRound.advanceDelay(correct.effect, settings)).toBe(720);

    const next = PracticeRound.advance(correct.snapshot, settings, rng, 1_600);
    expect(next.phase).toBe('question');
    expect(next.cursor).toBe(1);
    expect(next.exercise.id).toBe(started.exercise.id);
    expect(next.marks[0]?.correct).toBe(true);
    expect(next.grade).toBeNull();

    const wrongPitch = [0, 2, 4, 5, 7, 9, 11].find(
      (pitchClass) => pitchClass !== MusicTheory.pitchClass(next.exercise.slots[1]!.notes[0]!.midi),
    )!;
    const missed = PracticeRound.input(next, settings, wrongPitch, 1_800);
    expect(missed.effect).toBe('wrong');
    expect(missed.miss?.playedLabel).not.toBe('超时');
    expect(missed.miss?.expectedLabel).not.toBe('');
    expect(missed.snapshot.marks[1]?.correct).toBe(false);
    expect(missed.snapshot.score.attempts).toBe(2);
    expect(PracticeRound.advanceDelay(missed.effect, settings)).toBe(500);

    const newLine = PracticeRound.advance(missed.snapshot, settings, rng, 2_300);
    expect(newLine.phase).toBe('question');
    expect(newLine.cursor).toBe(0);
    expect(newLine.exercise.id).not.toBe(started.exercise.id);
    expect(newLine.exercise.slots).toHaveLength(1);

    const lastPitch = MusicTheory.pitchClass(newLine.exercise.slots[0]!.notes[0]!.midi);
    const last = PracticeRound.input(newLine, settings, lastPitch, 2_500);
    const summary = PracticeRound.advance(last.snapshot, settings, rng, 3_000);
    expect(summary.phase).toBe('summary');
  });
});