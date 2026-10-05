import type { AccidentalMode, Clef, PracticeSettings } from '@/music/types';

interface PresetDefinition {
  id: string;
  label: string;
  blurb: string;
  clefs: Clef[];
  lowestMidi: number;
  highestMidi: number;
  accidentalMode: AccidentalMode;
  minFifths: number;
  maxFifths: number;
  chromaticProbability: number;
  chordSizeMin: number;
  chordSizeMax: number;
  minInterval: number;
  timed: boolean;
  timeoutMs: number;
  sessionLength: number;
}

const DEFINITIONS: readonly PresetDefinition[] = [
  {
    id: 'beginner',
    label: '入门',
    blurb: '高音谱号，中央 C 到高音 C，只认自然音。',
    clefs: ['treble'],
    lowestMidi: 60,
    highestMidi: 72,
    accidentalMode: 'naturals',
    minFifths: 0,
    maxFifths: 0,
    chromaticProbability: 0,
    chordSizeMin: 1,
    chordSizeMax: 1,
    minInterval: 1,
    timed: false,
    timeoutMs: 8000,
    sessionLength: 20,
  },
  {
    id: 'easy',
    label: '简单',
    blurb: '高音谱号，含上下加线，每题 8 秒。',
    clefs: ['treble'],
    lowestMidi: 57,
    highestMidi: 77,
    accidentalMode: 'naturals',
    minFifths: 0,
    maxFifths: 0,
    chromaticProbability: 0,
    chordSizeMin: 1,
    chordSizeMax: 1,
    minInterval: 1,
    timed: true,
    timeoutMs: 8000,
    sessionLength: 20,
  },
  {
    id: 'intermediate',
    label: '中等',
    blurb: '高音与低音谱号、两个升降号以内的调号，以及双音。',
    clefs: ['treble', 'bass'],
    lowestMidi: 48,
    highestMidi: 79,
    accidentalMode: 'mixed',
    minFifths: -2,
    maxFifths: 2,
    chromaticProbability: 0.2,
    chordSizeMin: 1,
    chordSizeMax: 2,
    minInterval: 3,
    timed: true,
    timeoutMs: 7000,
    sessionLength: 20,
  },
  {
    id: 'advanced',
    label: '困难',
    blurb: '四种谱号、更宽音域、三音与更短的限时。',
    clefs: ['treble', 'bass', 'alto', 'tenor'],
    lowestMidi: 40,
    highestMidi: 84,
    accidentalMode: 'mixed',
    minFifths: -4,
    maxFifths: 4,
    chromaticProbability: 0.4,
    chordSizeMin: 1,
    chordSizeMax: 3,
    minInterval: 2,
    timed: true,
    timeoutMs: 4500,
    sessionLength: 20,
  },
  {
    id: 'bass',
    label: '低音',
    blurb: '只练低音谱号，从 C2 走到 A3。',
    clefs: ['bass'],
    lowestMidi: 36,
    highestMidi: 57,
    accidentalMode: 'naturals',
    minFifths: 0,
    maxFifths: 0,
    chromaticProbability: 0,
    chordSizeMin: 1,
    chordSizeMax: 1,
    minInterval: 1,
    timed: false,
    timeoutMs: 8000,
    sessionLength: 20,
  },
  {
    id: 'c-clef',
    label: '中音',
    blurb: '中音与次中音谱号，中央 C 附近，至多一个升降号。',
    clefs: ['alto', 'tenor'],
    lowestMidi: 48,
    highestMidi: 72,
    accidentalMode: 'mixed',
    minFifths: -1,
    maxFifths: 1,
    chromaticProbability: 0.1,
    chordSizeMin: 1,
    chordSizeMax: 2,
    minInterval: 3,
    timed: true,
    timeoutMs: 8000,
    sessionLength: 20,
  },
];

export class PracticePresets {
  static readonly list = DEFINITIONS;

  static byId(id: string): PresetDefinition {
    return this.list.find((preset) => preset.id === id) ?? this.list[0]!;
  }

  static apply(id: string, sound: boolean): PracticeSettings {
    const preset = this.byId(id);
    return {
      presetId: preset.id,
      clefs: [...preset.clefs],
      lowestMidi: preset.lowestMidi,
      highestMidi: preset.highestMidi,
      accidentalMode: preset.accidentalMode,
      minFifths: preset.minFifths,
      maxFifths: preset.maxFifths,
      chromaticProbability: preset.chromaticProbability,
      chordSizeMin: preset.chordSizeMin,
      chordSizeMax: preset.chordSizeMax,
      minInterval: preset.minInterval,
      timed: preset.timed,
      timeoutMs: preset.timeoutMs,
      sessionLength: preset.sessionLength,
      sound,
    };
  }

  static labelFor(id: string): string {
    if (id === 'custom') return '自定义';
    return this.byId(id).label;
  }
}
