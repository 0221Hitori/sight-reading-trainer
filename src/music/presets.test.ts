import { describe, expect, it } from 'vitest';
import { KeyboardMap } from '@/music/keyboard';
import { PracticePresets } from '@/music/presets';

describe('KeyboardMap', () => {
  it('covers twelve pitch classes on a QWERTY home position', () => {
    const classes = KeyboardMap.keys.map((key) => KeyboardMap.pitchClassFromCode(key.code));
    expect(new Set(classes).size).toBe(12);
    expect(KeyboardMap.pitchClassFromCode('Digit1')).toBe(0);
    expect(KeyboardMap.pitchClassFromCode('Numpad1')).toBe(0);
    expect(KeyboardMap.pitchClassFromCode('Numpad4')).toBe(5);
    expect(KeyboardMap.pitchClassFromCode('Numpad7')).toBe(11);
    expect(KeyboardMap.pitchClassFromCode('Numpad8')).toBeNull();
    expect(KeyboardMap.pitchClassFromCode('Numpad0')).toBeNull();
    expect(KeyboardMap.pitchClassFromKeyboardEvent({ code: 'Home', location: 3 })).toBe(11);
    expect(KeyboardMap.pitchClassFromKeyboardEvent({ code: 'End', location: 3 })).toBe(0);
    expect(KeyboardMap.pitchClassFromKeyboardEvent({ code: 'ArrowDown', location: 3 })).toBe(2);
    expect(KeyboardMap.pitchClassFromKeyboardEvent({ code: 'Clear', location: 3 })).toBe(7);
    expect(KeyboardMap.pitchClassFromKeyboardEvent({ code: 'Home', location: 0 })).toBeNull();
    expect(KeyboardMap.pitchClassFromKeyboardEvent({ code: 'ArrowLeft', location: 0 })).toBeNull();
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
    expect(advanced.lineLengthMin).toBe(4);
    expect(advanced.lineLengthMax).toBe(8);
    expect(advanced.sound).toBe(false);
    expect(PracticePresets.apply('beginner', true, 800).wrongAdvanceMs).toBe(800);
    expect(PracticePresets.apply('c-clef', true).clefs).toEqual(['alto', 'tenor']);
    const covered = new Set(PracticePresets.list.flatMap((preset) => preset.clefs));
    expect([...covered].sort()).toEqual(['alto', 'bass', 'tenor', 'treble']);
    expect(PracticePresets.labelFor('custom')).toBe('自定义');
  });
});
