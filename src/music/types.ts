/** Scientific pitch and practice-session types shared by generation, scoring, and the UI. */

export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Step = (typeof STEPS)[number];

export const CLEFS = ['treble', 'bass', 'alto', 'tenor'] as const;
export type Clef = (typeof CLEFS)[number];

export const ACCIDENTAL_MODES = ['naturals', 'sharps', 'flats', 'mixed'] as const;
export type AccidentalMode = (typeof ACCIDENTAL_MODES)[number];

/** -1 = flat, 0 = natural, 1 = sharp. Double accidentals are out of scope. */
export type AccidentalValue = -1 | 0 | 1;

export type PrintedAccidental = '#' | 'b' | 'n' | null;

export interface KeySignature {
  /** VexFlow key-signature spec, e.g. `Bb` or `F#`. */
  id: string;
  /** Position on the circle of fifths. Negative values are flat keys. */
  fifths: number;
  alterations: Partial<Record<Step, AccidentalValue>>;
  label: string;
}

export interface SpelledPitch {
  /** MIDI note number. Middle C is 60. */
  midi: number;
  step: Step;
  accidental: AccidentalValue;
  octave: number;
  /**
   * Glyph to draw on the note. `null` means the key signature already accounts
   * for this accidental, so printing another one would be redundant.
   */
  printedAccidental: PrintedAccidental;
}

export interface Exercise {
  id: string;
  clef: Clef;
  key: KeySignature;
  /** Low to high. Pitch classes are unique so a keyboard can answer the chord. */
  notes: SpelledPitch[];
}

export interface PracticeSettings {
  presetId: string;
  clefs: Clef[];
  lowestMidi: number;
  highestMidi: number;
  accidentalMode: AccidentalMode;
  minFifths: number;
  maxFifths: number;
  /** Chance that a chord tone is chromatic rather than diatonic to the key. */
  chromaticProbability: number;
  chordSizeMin: number;
  chordSizeMax: number;
  /** Minimum semitone gap between chord tones while the pool allows it. */
  minInterval: number;
  timed: boolean;
  timeoutMs: number;
  sound: boolean;
  sessionLength: number;
}

export type GradeReason = 'match' | 'wrong' | 'timeout' | 'reveal';

export interface Grade {
  correct: boolean;
  reason: GradeReason;
  wrongPitchClass: number | null;
}

export interface MissRecord {
  expectedLabel: string;
  playedLabel: string;
  /** Letter names without octave, used to aggregate lifetime misses. */
  noteNames: string[];
  clefLabel: string;
}

export interface LifetimeStats {
  version: 1;
  totalAttempts: number;
  totalCorrect: number;
  bestStreak: number;
  sessionsCompleted: number;
  missesByNote: Record<string, number>;
}
