import { describe, expect, it } from 'vitest';
import { PracticePresets } from '@/music/presets';
import { ProgressStore } from '@/storage/progress';

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe('ProgressStore', () => {
  it('round-trips settings and falls back when the payload is corrupt', () => {
    const storage = new MemoryStorage();
    const settings = PracticePresets.apply('bass', false);
    ProgressStore.saveSettings(settings, storage);
    expect(ProgressStore.loadSettings(storage).presetId).toBe('bass');
    expect(ProgressStore.loadSettings(storage).clefs).toEqual(['bass']);
    storage.setItem('sightread.settings.v1', '{not json');
    expect(ProgressStore.loadSettings(storage).presetId).toBe('beginner');
  });

  it('accumulates attempts, streaks, and missed note names', () => {
    const storage = new MemoryStorage();
    ProgressStore.recordAttempt(
      { correct: false, reason: 'wrong', wrongPitchClass: 2 },
      0,
      { expectedLabel: 'F♯4', playedLabel: 'F', noteNames: ['F♯'], clefLabel: '高音' },
      storage,
    );
    const again = ProgressStore.recordAttempt(
      { correct: true, reason: 'match', wrongPitchClass: null },
      4,
      null,
      storage,
    );
    expect(again.totalAttempts).toBe(2);
    expect(again.totalCorrect).toBe(1);
    expect(again.bestStreak).toBe(4);
    expect(again.missesByNote['F♯']).toBe(1);
    const finished = ProgressStore.completeSession(storage);
    expect(finished.sessionsCompleted).toBe(1);
  });
});
