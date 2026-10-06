/** 出题、判分和界面共用的音高与练习类型。标识符保持英文。 */

export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Step = (typeof STEPS)[number];

export const CLEFS = ['treble', 'bass', 'alto', 'tenor'] as const;
export type Clef = (typeof CLEFS)[number];

export const ACCIDENTAL_MODES = ['naturals', 'sharps', 'flats', 'mixed'] as const;
export type AccidentalMode = (typeof ACCIDENTAL_MODES)[number];

/** -1 降号，0 自然，1 升号。重升、重降不在范围内。 */
export type AccidentalValue = -1 | 0 | 1;

export type PrintedAccidental = '#' | 'b' | 'n' | null;

export interface KeySignature {
  /** VexFlow 调号写法，例如 `Bb`、`F#`。 */
  id: string;
  /** 五度圈位置。负数是降号调，0 是 C 大调，正数是升号调。 */
  fifths: number;
  alterations: Partial<Record<Step, AccidentalValue>>;
  label: string;
}

export interface SpelledPitch {
  /** MIDI 音高。中央 C 是 60。 */
  midi: number;
  step: Step;
  accidental: AccidentalValue;
  octave: number;
  /**
   * 要画在符头上的记号。`null` 表示调号已经说明了这个升降，不必再印。
   * `n` 是还原号，用来取消调号。
   */
  printedAccidental: PrintedAccidental;
}

/** 一行里的一个作答位置。可以是单音，也可以是和弦。节奏不计分。 */
export interface AnswerSlot {
  /** 从低到高。音级互不相同，键盘才能按音级答完和弦。 */
  notes: SpelledPitch[];
}

export interface Exercise {
  id: string;
  clef: Clef;
  key: KeySignature;
  /**
   * 从左到右。同一行共用谱号和调号。
   * 长度由 `lineLengthMin` / `lineLengthMax` 决定，最后一行会收进本轮剩余题数。
   */
  slots: AnswerSlot[];
}

export interface PracticeSettings {
  presetId: string;
  clefs: Clef[];
  lowestMidi: number;
  highestMidi: number;
  accidentalMode: AccidentalMode;
  minFifths: number;
  maxFifths: number;
  /** 某个和弦音离开调内、改抽变化音的概率。 */
  chromaticProbability: number;
  chordSizeMin: number;
  chordSizeMax: number;
  /** 和弦音之间至少相隔多少个半音。音池不够时生成器会把间隔降到 1。 */
  minInterval: number;
  /** 一行最少几个音（每个音或和弦算一个）。 */
  lineLengthMin: number;
  /** 一行最多几个音。实际行长在这个闭区间里随机。 */
  lineLengthMax: number;
  /** 答错后多久自动进入下一个音，单位毫秒。 */
  wrongAdvanceMs: number;
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
  /** 不带八度的音名，用来累计「容易混淆」。 */
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
  /** 最近的错题，新的在前。存在 localStorage 里，和只活在内存中的本轮列表不同。 */
  recentMisses: MissRecord[];
}
