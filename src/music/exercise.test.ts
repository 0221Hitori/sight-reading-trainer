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
    expect(seen.size).toBeGreaterThanOrEqual(3);
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
