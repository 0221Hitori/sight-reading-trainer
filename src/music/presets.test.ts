import { describe, expect, it } from 'vitest';
import { KeyboardMap } from '@/music/keyboard';
import { PracticePresets } from '@/music/presets';

describe('KeyboardMap', () => {
  it('covers twelve pitch classes on a QWERTY home position', () => {
    const classes = KeyboardMap.keys.map((key) => KeyboardMap.pitchClassFromCode(key.code));
    expect(new Set(classes).size).toBe(12);
    expect(KeyboardMap.pitchClassFromCode('Digit1')).toBe(0);
    expect(KeyboardMap.pitchClassFromCode('KeyQ')).toBe(1);
    expect(KeyboardMap.pitchClassFromCode('KeyY')).toBe(10);
    expect(KeyboardMap.pitchClassFromCode('Digit7')).toBe(11);
    expect(KeyboardMap.pitchClassFromCode('KeyE')).toBeNull();
    expect(KeyboardMap.whiteKeys()).toHaveLength(7);
    expect(KeyboardMap.blackKeys()).toHaveLength(5);
  });
});

describe('PracticePresets', () => {
  it('ships more than three presets, including multi-clef chords', () => {
    expect(PracticePresets.list.length).toBeGreaterThanOrEqual(3);
    const intermediate = PracticePresets.apply('intermediate', true);
    const advanced = PracticePresets.apply('advanced', false);
    expect(intermediate.clefs.length).toBeGreaterThanOrEqual(2);
    expect(intermediate.chordSizeMax).toBeGreaterThanOrEqual(2);
    expect(advanced.clefs).toEqual(['treble', 'bass', 'alto', 'tenor']);
    expect(advanced.sound).toBe(false);
    expect(PracticePresets.apply('c-clef', true).clefs).toEqual(['alto', 'tenor']);
    const covered = new Set(PracticePresets.list.flatMap((preset) => preset.clefs));
    expect([...covered].sort()).toEqual(['alto', 'bass', 'tenor', 'treble']);
    expect(PracticePresets.labelFor('custom')).toBe('自定义');
  });
});
