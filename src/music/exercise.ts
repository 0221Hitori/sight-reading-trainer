import { MusicTheory } from '@/music/theory';
import type { Clef, Exercise, KeySignature, PracticeSettings, SpelledPitch } from '@/music/types';

/**
 * 按当前设置出一道谱题。
 * 顺序是：收紧设置 → 选调 → 选谱号 → 在音池里抽和弦 → 按调号拼写。
 */
export class ExerciseGenerator {
  /** `rng` 返回 [0, 1)。测试传入种子生成器，界面用 `Math.random`。 */
  static next(settings: PracticeSettings, rng: () => number = Math.random): Exercise {
    const safe = this.normalize(settings);
    const key = this.pickKey(safe, rng);
    const clef = this.pickClef(safe, key, rng);
    const pool = this.midiPool(safe, key, clef);
    const diatonic = pool.filter((midi) => MusicTheory.isDiatonic(MusicTheory.pitchClass(midi), key));
    const tonalPool = diatonic.length > 0 ? diatonic : pool;
    const distinct = new Set(pool.map((midi) => MusicTheory.pitchClass(midi))).size;
    const size = Math.max(1, Math.min(this.pickInt(safe.chordSizeMin, safe.chordSizeMax, rng), distinct || 1));
    const midis = this.chooseMidis(safe, tonalPool, pool, size, rng, key);
    const notes = midis
      .slice()
      .sort((left, right) => left - right)
      .map((midi) => MusicTheory.spell(midi, key, safe.accidentalMode));
    return {
      id: `ex-${Math.floor(rng() * 0xffffffff).toString(16)}`,
      clef,
      key,
      notes,
    };
  }

  /** 把越界或颠倒的设置收进生成器能出题的范围。空谱号列表退回高音谱号。 */
  static normalize(settings: PracticeSettings): PracticeSettings {
    const clefs = settings.clefs.length > 0 ? [...settings.clefs] : (['treble'] as Clef[]);
    let lowest = Math.round(settings.lowestMidi);
    let highest = Math.round(settings.highestMidi);
    if (lowest > highest) {
      const swap = lowest;
      lowest = highest;
      highest = swap;
    }
    if (highest - lowest < 2) highest = lowest + 2;
    const chordSizeMin = this.clampInt(settings.chordSizeMin, 1, 4);
    const chordSizeMax = this.clampInt(Math.max(settings.chordSizeMax, chordSizeMin), 1, 4);
    const minFifths = this.clampInt(Math.min(settings.minFifths, settings.maxFifths), -7, 7);
    const maxFifths = this.clampInt(Math.max(settings.minFifths, settings.maxFifths), -7, 7);
    return {
      ...settings,
      clefs,
      lowestMidi: lowest,
      highestMidi: highest,
      chordSizeMin,
      chordSizeMax,
      minFifths,
      maxFifths,
      chromaticProbability: this.clampNumber(settings.chromaticProbability, 0, 1),
      minInterval: this.clampInt(settings.minInterval, 1, 12),
      timeoutMs: this.clampInt(settings.timeoutMs, 1000, 30000),
      sessionLength: this.clampInt(settings.sessionLength, 5, 100),
    };
  }

  /**
   * 在五度圈区间里选调。自然音只留 C 大调，升号模式只要 fifths ≥ 0，降号模式只要 fifths ≤ 0。
   * 筛完是空的就退回 C 大调，避免设置互相矛盾时出不了题。
   */
  private static pickKey(settings: PracticeSettings, rng: () => number): KeySignature {
    const candidates = MusicTheory.allKeys().filter((key) => {
      if (key.fifths < settings.minFifths || key.fifths > settings.maxFifths) return false;
      if (settings.accidentalMode === 'naturals') return key.fifths === 0;
      if (settings.accidentalMode === 'sharps') return key.fifths >= 0;
      if (settings.accidentalMode === 'flats') return key.fifths <= 0;
      return true;
    });
    const pool = candidates.length > 0 ? candidates : [MusicTheory.keyByFifths(0)];
    return pool[Math.floor(rng() * pool.length)] ?? MusicTheory.keyByFifths(0);
  }

  /** 优先选音池够放下 `chordSizeMin` 个音的谱号，避免窄音域谱号抽不出和弦。 */
  private static pickClef(settings: PracticeSettings, key: KeySignature, rng: () => number): Clef {
    const ranked = settings.clefs
      .map((clef) => ({ clef, count: this.midiPool(settings, key, clef).length }))
      .filter((item) => item.count > 0);
    const roomy = ranked.filter((item) => item.count >= settings.chordSizeMin);
    const pool = (roomy.length > 0 ? roomy : ranked).map((item) => item.clef);
    const choices = pool.length > 0 ? pool : settings.clefs;
    return choices[Math.floor(rng() * choices.length)] ?? 'treble';
  }

  /**
   * 设置音域和谱号窗口的交集。交集为空时退回设置音域，否则这个谱号一题都出不来。
   * 自然音丢掉黑键。
   */
  private static midiPool(settings: PracticeSettings, key: KeySignature, clef: Clef): number[] {
    const window = MusicTheory.clefWindow(clef);
    let low = Math.max(settings.lowestMidi, window.low);
    let high = Math.min(settings.highestMidi, window.high);
    if (low > high) {
      low = settings.lowestMidi;
      high = settings.highestMidi;
    }
    const midis: number[] = [];
    for (let midi = low; midi <= high; midi += 1) {
      const pitchClass = MusicTheory.pitchClass(midi);
      if (settings.accidentalMode === 'naturals' && !MusicTheory.isNatural(pitchClass)) continue;
      if (settings.chromaticProbability <= 0 && settings.accidentalMode === 'naturals' && !MusicTheory.isDiatonic(pitchClass, key)) {
        continue;
      }
      midis.push(midi);
    }
    return midis;
  }

  /**
   * 先按设置的最小音程抽。抽不满再把音程降到 1 个半音重试。
   * 仍然一个音都没有时，退回音池里的单音。
   */
  private static chooseMidis(
    settings: PracticeSettings,
    diatonic: readonly number[],
    all: readonly number[],
    size: number,
    rng: () => number,
    key: KeySignature,
  ): number[] {
    const chosen: number[] = [];
    const allowChromatic = settings.chromaticProbability > 0 && settings.accidentalMode !== 'naturals';
    for (const minInterval of [settings.minInterval, 1]) {
      let guard = 0;
      while (chosen.length < size && guard < 120) {
        guard += 1;
        const useChromatic = allowChromatic && rng() < settings.chromaticProbability;
        const source = useChromatic && all.length > 0 ? all : diatonic;
        if (source.length === 0) break;
        const midi = source[Math.floor(rng() * source.length)];
        if (midi === undefined || !this.fits(chosen, midi, minInterval, key, settings)) continue;
        chosen.push(midi);
      }
      if (chosen.length >= size) break;
    }
    if (chosen.length === 0) {
      const fallback = all[Math.floor(rng() * all.length)] ?? diatonic[0] ?? 60;
      chosen.push(fallback);
    }
    return chosen;
  }

  private static fits(
    chosen: readonly number[],
    midi: number,
    minInterval: number,
    key: KeySignature,
    settings: PracticeSettings,
  ): boolean {
    const pitchClass = MusicTheory.pitchClass(midi);
    const step = MusicTheory.spell(midi, key, settings.accidentalMode).step;
    return chosen.every((existing) => {
      if (MusicTheory.pitchClass(existing) === pitchClass) return false;
      if (Math.abs(existing - midi) < minInterval) return false;
      // C 和 C♯ 共用一个谱位字母，叠成和弦时符头会撞在一起。
      return MusicTheory.spell(existing, key, settings.accidentalMode).step !== step;
    });
  }

  private static pickInt(min: number, max: number, rng: () => number): number {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return low + Math.floor(rng() * (high - low + 1));
  }

  private static clampInt(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  private static clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }
}

/** 谱面标题。判分之前只写谱号、调号和音数，不写出具体音名。 */
export class ExerciseView {
  static meta(exercise: Exercise): string {
    const density = exercise.notes.length === 1 ? '单音' : `${exercise.notes.length} 个音`;
    return `${MusicTheory.clefLabel(exercise.clef)} · ${exercise.key.label} · ${density}`;
  }

  static answerLabel(notes: readonly SpelledPitch[]): string {
    return notes.map((note) => MusicTheory.formatName(note)).join('  ');
  }

  static letterNames(notes: readonly SpelledPitch[]): string[] {
    return notes.map((note) => MusicTheory.formatName(note, false));
  }
}

