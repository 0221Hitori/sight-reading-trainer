import type {
  AccidentalMode,
  AccidentalValue,
  Clef,
  KeySignature,
  PrintedAccidental,
  SpelledPitch,
  Step,
} from '@/music/types';

interface SpellingOption {
  step: Step;
  accidental: AccidentalValue;
}

const SHARP_ORDER: readonly Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: readonly Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const KEY_IDS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'] as const;
const NATURAL_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

/**
 * 每个音级的常用等音拼写。
 * 含 B♯、E♯ 等少见拼法，升号调仍能拼出来；变化音择优时会扣这些拼法的分。
 */
const SPELLINGS: readonly (readonly SpellingOption[])[] = [
  [
    { step: 'C', accidental: 0 },
    { step: 'B', accidental: 1 },
  ],
  [
    { step: 'C', accidental: 1 },
    { step: 'D', accidental: -1 },
  ],
  [{ step: 'D', accidental: 0 }],
  [
    { step: 'D', accidental: 1 },
    { step: 'E', accidental: -1 },
  ],
  [
    { step: 'E', accidental: 0 },
    { step: 'F', accidental: -1 },
  ],
  [
    { step: 'F', accidental: 0 },
    { step: 'E', accidental: 1 },
  ],
  [
    { step: 'F', accidental: 1 },
    { step: 'G', accidental: -1 },
  ],
  [{ step: 'G', accidental: 0 }],
  [
    { step: 'G', accidental: 1 },
    { step: 'A', accidental: -1 },
  ],
  [{ step: 'A', accidental: 0 }],
  [
    { step: 'A', accidental: 1 },
    { step: 'B', accidental: -1 },
  ],
  [
    { step: 'B', accidental: 0 },
    { step: 'C', accidental: -1 },
  ],
];

const STEP_INDEX: Record<Step, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** 各谱号的可读 MIDI 窗口，以及谱表最下方那条线的音名。窗口留了一点加线空间。 */
const CLEF_INFO: Record<Clef, { label: string; full: string; low: number; high: number; bottomStep: Step; bottomOctave: number }> = {
  treble: { label: '高音', full: '高音谱号', low: 55, high: 84, bottomStep: 'E', bottomOctave: 4 },
  bass: { label: '低音', full: '低音谱号', low: 36, high: 64, bottomStep: 'G', bottomOctave: 2 },
  alto: { label: '中音', full: '中音谱号', low: 48, high: 76, bottomStep: 'F', bottomOctave: 3 },
  tenor: { label: '次中音', full: '次中音谱号', low: 43, high: 72, bottomStep: 'D', bottomOctave: 3 },
};

/**
 * 音高拼写、调号和谱号音域。
 * 符头按音名字母定位；调号已经隐含的变音不再另印。
 * MIDI 中央 C 是 60。
 */
export class MusicTheory {
  private static cachedKeys: KeySignature[] | null = null;

  /** 折成 0–11。JS 里负数取模仍可能为负，所以再加 12。 */
  static pitchClass(midi: number): number {
    return ((midi % 12) + 12) % 12;
  }

  /** 科学音高八度。MIDI 60 是 C4。 */
  static octaveOf(midi: number): number {
    return Math.floor(midi / 12) - 1;
  }

  static isNatural(pitchClass: number): boolean {
    return NATURAL_PITCH_CLASSES.has(this.pitchClass(pitchClass));
  }

  /** 五度圈上的主音。每多一个升号，主音升一个纯五度（音级 +7）。 */
  static tonicPitchClass(fifths: number): number {
    return (((fifths * 7) % 12) + 12) % 12;
  }

  static isDiatonic(pitchClass: number, key: KeySignature): boolean {
    const tonic = this.tonicPitchClass(key.fifths);
    const scale = [0, 2, 4, 5, 7, 9, 11].map((step) => (tonic + step) % 12);
    return scale.includes(this.pitchClass(pitchClass));
  }

  /** 调号里被升降的音名。升号顺序 F C G D A E B，降号顺序相反。 */
  static alterations(fifths: number): Partial<Record<Step, AccidentalValue>> {
    const map: Partial<Record<Step, AccidentalValue>> = {};
    if (fifths > 0) {
      for (let index = 0; index < fifths && index < SHARP_ORDER.length; index += 1) {
        const step = SHARP_ORDER[index];
        if (step) map[step] = 1;
      }
    } else if (fifths < 0) {
      for (let index = 0; index < -fifths && index < FLAT_ORDER.length; index += 1) {
        const step = FLAT_ORDER[index];
        if (step) map[step] = -1;
      }
    }
    return map;
  }

  static prettyKeyName(id: string): string {
    if (id.endsWith('b') && id.length > 1) return `${id.slice(0, -1)}♭`;
    if (id.endsWith('#') && id.length > 1) return `${id.slice(0, -1)}♯`;
    return id;
  }

  static keyLabel(fifths: number, id: string): string {
    const name = this.prettyKeyName(id);
    if (fifths === 0) return `${name} 大调`;
    if (fifths > 0) return `${name} 大调 · ${fifths} 个升号`;
    return `${name} 大调 · ${-fifths} 个降号`;
  }

  static allKeys(): KeySignature[] {
    if (!this.cachedKeys) {
      this.cachedKeys = KEY_IDS.map((id, index) => {
        const fifths = index - 7;
        return {
          id,
          fifths,
          alterations: this.alterations(fifths),
          label: this.keyLabel(fifths, id),
        };
      });
    }
    return this.cachedKeys;
  }

  static keyByFifths(fifths: number): KeySignature {
    return this.allKeys().find((key) => key.fifths === fifths) ?? this.allKeys()[7]!;
  }

  static clefLabel(clef: Clef): string {
    return CLEF_INFO[clef].full;
  }

  static clefShort(clef: Clef): string {
    return CLEF_INFO[clef].label;
  }

  static clefWindow(clef: Clef): { low: number; high: number } {
    return { low: CLEF_INFO[clef].low, high: CLEF_INFO[clef].high };
  }

  /**
   * 符头是否落在加线上或加线之外。
   * 紧贴谱表外侧的间（例如高音谱号下的 D4）不算加线。
   * 位置按全音阶级数：底线是 0，向上每条线或每个间 +1。
   */
  static usesLedgerLine(clef: Clef, pitch: Pick<SpelledPitch, 'step' | 'octave'>): boolean {
    const info = CLEF_INFO[clef];
    const bottom = info.bottomOctave * 7 + STEP_INDEX[info.bottomStep];
    const position = pitch.octave * 7 + STEP_INDEX[pitch.step] - bottom;
    return position <= -2 || position >= 10;
  }

  static accidentalGlyph(accidental: number): string {
    if (accidental > 0) return '♯';
    if (accidental < 0) return '♭';
    return '';
  }

  static formatName(pitch: Pick<SpelledPitch, 'step' | 'accidental' | 'octave'>, withOctave = true): string {
    const letter = `${pitch.step}${this.accidentalGlyph(pitch.accidental)}`;
    return withOctave ? `${letter}${pitch.octave}` : letter;
  }

  static formatPitchClass(pitchClass: number, key: KeySignature, mode: AccidentalMode): string {
    const spelled = this.spell(60 + this.pitchClass(pitchClass), key, mode);
    return this.formatName(spelled, false);
  }

  /** VexFlow 用字母定位符头，例如 `c/4`。变音记号另加 Accidental，不写进这个字符串。 */
  static vexflowKey(pitch: Pick<SpelledPitch, 'step' | 'octave'>): string {
    return `${pitch.step.toLowerCase()}/${pitch.octave}`;
  }

  /** 与调号一致则不印；需要取消调号时印还原号 `n`。 */
  static printedAccidental(step: Step, accidental: AccidentalValue, key: KeySignature): PrintedAccidental {
    const fromKey = key.alterations[step] ?? 0;
    if (accidental === fromKey) return null;
    if (accidental === 0) return 'n';
    return accidental > 0 ? '#' : 'b';
  }

  /**
   * 按调号拼写一个 MIDI 音。
   * 调内音沿用调号的拼法，即使那个字母已经带升降号（G 大调的 F♯）。
   * 调外音再按升降号偏好挑选等音。
   */
  static spell(midi: number, key: KeySignature, mode: AccidentalMode = 'mixed'): SpelledPitch {
    const pitchClass = this.pitchClass(midi);
    const options = SPELLINGS[pitchClass] ?? [{ step: 'C' as const, accidental: 0 as const }];
    const diatonic = options.find((option) => (key.alterations[option.step] ?? 0) === option.accidental);
    const chosen = diatonic ?? this.pickChromaticSpelling(options, key, mode);
    return {
      midi,
      step: chosen.step,
      accidental: chosen.accidental,
      octave: this.octaveOf(midi),
      printedAccidental: this.printedAccidental(chosen.step, chosen.accidental, key),
    };
  }

  /** 离 `anchor` 最近的那个八度，用来把按错的音级响在谱面附近。 */
  static nearestMidi(pitchClass: number, anchor: number): number {
    const anchorClass = this.pitchClass(anchor);
    let delta = this.pitchClass(pitchClass) - anchorClass;
    if (delta > 6) delta -= 12;
    if (delta < -6) delta += 12;
    return anchor + delta;
  }

  static noteChoices(low = 36, high = 84): { midi: number; label: string }[] {
    const key = this.keyByFifths(0);
    const choices: { midi: number; label: string }[] = [];
    for (let midi = low; midi <= high; midi += 1) {
      choices.push({ midi, label: this.formatName(this.spell(midi, key, 'sharps')) });
    }
    return choices;
  }

  /**
   * 调外音的等音择优。降号调或降号模式偏向♭，否则偏向♯；
   * E♯、B♯、F♭、C♭ 额外扣分，避免识谱题出现少见拼法。
   */
  private static pickChromaticSpelling(
    options: readonly SpellingOption[],
    key: KeySignature,
    mode: AccidentalMode,
  ): SpellingOption {
    const preferFlats = mode === 'flats' || (mode === 'mixed' && key.fifths < 0);
    let best = options[0]!;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const option of options) {
      let score = -Math.abs(option.accidental) * 2;
      if (preferFlats) score += option.accidental < 0 ? 3 : option.accidental > 0 ? -3 : 0;
      else score += option.accidental > 0 ? 3 : option.accidental < 0 ? -3 : 1;
      if (this.isRemoteSpelling(option)) score -= 4;
      if (score > bestScore) {
        best = option;
        bestScore = score;
      }
    }
    return best;
  }

  private static isRemoteSpelling(option: SpellingOption): boolean {
    return (
      (option.step === 'E' && option.accidental === 1) ||
      (option.step === 'B' && option.accidental === 1) ||
      (option.step === 'F' && option.accidental === -1) ||
      (option.step === 'C' && option.accidental === -1)
    );
  }
}
