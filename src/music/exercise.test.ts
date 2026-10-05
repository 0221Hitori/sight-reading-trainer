import { describe, expect, it } from 'vitest';
import { ExerciseGenerator } from '@/music/exercise';
import { MusicTheory } from '@/music/theory';
import { PracticePresets } from '@/music/presets';
import { RandomSource } from '@/music/random';
import type { PracticeSettings } from '@/music/types';

describe('ExerciseGenerator', () => {
  it('is deterministic for a seed', () => {
    const settings = PracticePresets.apply('intermediate', true);
    const first = ExerciseGenerator.next(settings, RandomSource.mulberry32(11));
    const second = ExerciseGenerator.next(settings, RandomSource.mulberry32(11));
    expect(first.clef).toBe(second.clef);
    expect(first.notes.map((note) => note.midi)).toEqual(second.notes.map((note) => note.midi));
  });

  it('keeps beginner questions on the treble staff, in range, and natural', () => {
    const settings = PracticePresets.apply('beginner', false);
    const rng = RandomSource.mulberry32(4);
    for (let index = 0; index < 30; index += 1) {
      const exercise = ExerciseGenerator.next(settings, rng);
      expect(exercise.clef).toBe('treble');
      expect(exercise.key.fifths).toBe(0);
      expect(exercise.notes).toHaveLength(1);
      const note = exercise.notes[0]!;
      expect(note.midi).toBeGreaterThanOrEqual(60);
      expect(note.midi).toBeLessThanOrEqual(72);
      expect(note.accidental).toBe(0);
      expect(MusicTheory.isNatural(note.midi)).toBe(true);
    }
  });

  it('can build multi-note questions on every clef', () => {
    const settings: PracticeSettings = {
      ...PracticePresets.apply('advanced', true),
      chordSizeMin: 2,
      chordSizeMax: 3,
      chromaticProbability: 0,
    };
    const seen = new Set<string>();
    const rng = RandomSource.mulberry32(19);
    for (let index = 0; index < 80; index += 1) {
      const exercise = ExerciseGenerator.next(settings, rng);
      seen.add(exercise.clef);
      expect(exercise.notes.length).toBeGreaterThanOrEqual(2);
      expect(exercise.notes.length).toBeLessThanOrEqual(3);
      const classes = exercise.notes.map((note) => MusicTheory.pitchClass(note.midi));
      expect(new Set(classes).size).toBe(classes.length);
      const midis = exercise.notes.map((note) => note.midi);
      expect([...midis].sort((a, b) => a - b)).toEqual(midis);
      for (const note of exercise.notes) {
        expect(note.midi).toBeGreaterThanOrEqual(settings.lowestMidi);
        expect(note.midi).toBeLessThanOrEqual(settings.highestMidi);
        expect(MusicTheory.isDiatonic(note.midi, exercise.key)).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual(['alto', 'bass', 'tenor', 'treble']);
    for (const exercise of [ExerciseGenerator.next(settings, rng)]) {
      const steps = exercise.notes.map((note) => note.step);
      expect(new Set(steps).size).toBe(steps.length);
    }
  });

  it('prints an accidental when the note leaves the key, and can use each clef alone', () => {
    const chromatic: PracticeSettings = {
      ...PracticePresets.apply('advanced', true),
      clefs: ['treble'],
      accidentalMode: 'sharps',
      minFifths: 0,
      maxFifths: 0,
      chromaticProbability: 1,
      chordSizeMin: 1,
      chordSizeMax: 1,
    };
    const printed = new Set<string>();
    const rng = RandomSource.mulberry32(5);
    for (let index = 0; index < 40; index += 1) {
      const exercise = ExerciseGenerator.next(chromatic, rng);
      const note = exercise.notes[0]!;
      if (note.printedAccidental) printed.add(note.printedAccidental);
      expect(exercise.key.fifths).toBe(0);
    }
    expect(printed.has('#')).toBe(true);

    for (const clef of ['treble', 'bass', 'alto', 'tenor'] as const) {
      const solo: PracticeSettings = {
        ...PracticePresets.apply('advanced', true),
        clefs: [clef],
        chromaticProbability: 0,
      };
      const exercise = ExerciseGenerator.next(solo, RandomSource.mulberry32(2));
      expect(exercise.clef).toBe(clef);
    }
  });

  it('includes ledger-line notes once the range leaves the staff', () => {
    const settings = PracticePresets.apply('easy', true);
    const rng = RandomSource.mulberry32(6);
    let ledger = 0;
    for (let index = 0; index < 40; index += 1) {
      const exercise = ExerciseGenerator.next(settings, rng);
      if (exercise.notes.some((note) => MusicTheory.usesLedgerLine(exercise.clef, note))) ledger += 1;
    }
    expect(ledger).toBeGreaterThan(0);
  });

  it('never puts two spellings of the same staff letter in one chord', () => {
    const settings: PracticeSettings = {
      ...PracticePresets.apply('advanced', true),
      clefs: ['treble'],
      accidentalMode: 'mixed',
      minFifths: -2,
      maxFifths: 2,
      chromaticProbability: 1,
      chordSizeMin: 2,
      chordSizeMax: 3,
      minInterval: 1,
    };
    const rng = RandomSource.mulberry32(42);
    for (let index = 0; index < 40; index += 1) {
      const exercise = ExerciseGenerator.next(settings, rng);
      const steps = exercise.notes.map((note) => note.step);
      expect(new Set(steps).size).toBe(steps.length);
      expect(exercise.notes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('stays inside the requested key-signature range', () => {
    const settings: PracticeSettings = {
      ...PracticePresets.apply('advanced', true),
      accidentalMode: 'sharps',
      minFifths: 1,
      maxFifths: 2,
      chromaticProbability: 0,
    };
    const rng = RandomSource.mulberry32(3);
    for (let index = 0; index < 20; index += 1) {
      const exercise = ExerciseGenerator.next(settings, rng);
      expect(exercise.key.fifths).toBeGreaterThanOrEqual(1);
      expect(exercise.key.fifths).toBeLessThanOrEqual(2);
    }
  });

  it('generates every preset without throwing', () => {
    for (const preset of PracticePresets.list) {
      const settings = PracticePresets.apply(preset.id, true);
      const rng = RandomSource.mulberry32(8);
      for (let index = 0; index < 15; index += 1) {
        const exercise = ExerciseGenerator.next(settings, rng);
        expect(settings.clefs).toContain(exercise.clef);
        expect(exercise.notes.length).toBeGreaterThan(0);
      }
    }
  });
});
