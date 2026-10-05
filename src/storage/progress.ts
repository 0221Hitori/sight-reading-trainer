import { ExerciseGenerator } from '@/music/exercise';
import { PracticePresets } from '@/music/presets';
import type { Clef, Grade, LifetimeStats, MissRecord, PracticeSettings } from '@/music/types';
import { ACCIDENTAL_MODES, CLEFS } from '@/music/types';

const SETTINGS_KEY = 'sightread.settings.v1';
const STATS_KEY = 'sightread.stats.v1';

/**
 * 设置和累计成绩的本地存储。
 * 测试传入自己的 Storage；浏览器使用 localStorage。没有 localStorage 时退回内存表。
 * 读写失败（隐私模式、磁盘满）时练习仍可继续。
 */
export class ProgressStore {
  static loadSettings(storage?: Storage): PracticeSettings {
    const raw = this.read(SETTINGS_KEY, storage);
    if (!raw) return PracticePresets.apply('beginner', true);
    try {
      return this.sanitizeSettings(JSON.parse(raw));
    } catch {
      return PracticePresets.apply('beginner', true);
    }
  }

  static saveSettings(settings: PracticeSettings, storage?: Storage): void {
    this.write(SETTINGS_KEY, JSON.stringify(settings), storage);
  }

  static loadStats(storage?: Storage): LifetimeStats {
    const raw = this.read(STATS_KEY, storage);
    if (!raw) return this.emptyStats();
    try {
      return this.sanitizeStats(JSON.parse(raw));
    } catch {
      return this.emptyStats();
    }
  }

  static recordAttempt(
    grade: Grade,
    bestStreak: number,
    miss: MissRecord | null,
    storage?: Storage,
  ): LifetimeStats {
    const current = this.loadStats(storage);
    const missesByNote = { ...current.missesByNote };
    if (miss) {
      for (const name of miss.noteNames) {
        missesByNote[name] = (missesByNote[name] ?? 0) + 1;
      }
    }
    const next: LifetimeStats = {
      version: 1,
      totalAttempts: current.totalAttempts + 1,
      totalCorrect: current.totalCorrect + (grade.correct ? 1 : 0),
      bestStreak: Math.max(current.bestStreak, bestStreak),
      sessionsCompleted: current.sessionsCompleted,
      missesByNote,
      recentMisses: miss ? [miss, ...current.recentMisses].slice(0, 12) : current.recentMisses, // 新的在前，只留 12 条
    };
    this.write(STATS_KEY, JSON.stringify(next), storage);
    return next;
  }

  static completeSession(storage?: Storage): LifetimeStats {
    const current = this.loadStats(storage);
    const next: LifetimeStats = { ...current, sessionsCompleted: current.sessionsCompleted + 1 };
    this.write(STATS_KEY, JSON.stringify(next), storage);
    return next;
  }

  static emptyStats(): LifetimeStats {
    return {
      version: 1,
      totalAttempts: 0,
      totalCorrect: 0,
      bestStreak: 0,
      sessionsCompleted: 0,
      missesByNote: {},
      recentMisses: [],
    };
  }

  private static sanitizeSettings(input: unknown): PracticeSettings {
    const fallback = PracticePresets.apply('beginner', true);
    if (!input || typeof input !== 'object') return fallback;
    const record = input as Partial<PracticeSettings>;
    const clefs = Array.isArray(record.clefs)
      ? record.clefs.filter((clef): clef is Clef => typeof clef === 'string' && (CLEFS as readonly string[]).includes(clef))
      : fallback.clefs;
    const accidentalMode =
      typeof record.accidentalMode === 'string' &&
      (ACCIDENTAL_MODES as readonly string[]).includes(record.accidentalMode)
        ? record.accidentalMode
        : fallback.accidentalMode;
    const merged: PracticeSettings = {
      ...fallback,
      ...record,
      presetId: typeof record.presetId === 'string' ? record.presetId : fallback.presetId,
      clefs: clefs.length > 0 ? clefs : fallback.clefs,
      accidentalMode,
      sound: typeof record.sound === 'boolean' ? record.sound : fallback.sound,
      timed: typeof record.timed === 'boolean' ? record.timed : fallback.timed,
    };
    return ExerciseGenerator.normalize(merged);
  }

  private static sanitizeStats(input: unknown): LifetimeStats {
    const empty = this.emptyStats();
    if (!input || typeof input !== 'object') return empty;
    const record = input as Partial<LifetimeStats>;
    const misses: Record<string, number> = {};
    if (record.missesByNote && typeof record.missesByNote === 'object') {
      for (const [name, count] of Object.entries(record.missesByNote)) {
        if (typeof count === 'number' && Number.isFinite(count)) misses[name] = count;
      }
    }
    return {
      version: 1,
      totalAttempts: finite(record.totalAttempts, 0),
      totalCorrect: finite(record.totalCorrect, 0),
      bestStreak: finite(record.bestStreak, 0),
      sessionsCompleted: finite(record.sessionsCompleted, 0),
      missesByNote: misses,
      recentMisses: sanitizeMisses(record.recentMisses),
    };
  }

  private static read(key: string, storage?: Storage): string | null {
    try {
      return this.resolve(storage).getItem(key);
    } catch {
      return null;
    }
  }

  private static write(key: string, value: string, storage?: Storage): void {
    try {
      this.resolve(storage).setItem(key, value);
    } catch {
      // Private mode and full disks should not break practice.
    }
  }

  private static resolve(storage?: Storage): Pick<Storage, 'getItem' | 'setItem'> {
    if (storage) return storage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return memoryStorage;
  }
}

const memory = new Map<string, string>();
const memoryStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 旧成绩文件没有 recentMisses，或条目缺字段时丢掉，避免一次坏数据弄空整份统计。 */
function sanitizeMisses(value: unknown): MissRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Partial<MissRecord>;
    if (typeof record.expectedLabel !== 'string' || typeof record.playedLabel !== 'string') return [];
    const noteNames = Array.isArray(record.noteNames)
      ? record.noteNames.filter((name): name is string => typeof name === 'string')
      : [];
    return [
      {
        expectedLabel: record.expectedLabel,
        playedLabel: record.playedLabel,
        noteNames,
        clefLabel: typeof record.clefLabel === 'string' ? record.clefLabel : '',
      },
    ];
  });
}
