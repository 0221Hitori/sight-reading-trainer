import { describe, expect, it } from 'vitest';
import { MusicTheory } from '@/music/theory';

describe('MusicTheory', () => {
  it('maps middle C and A4 to MIDI numbers', () => {
    expect(MusicTheory.pitchClass(60)).toBe(0);
    expect(MusicTheory.octaveOf(60)).toBe(4);
    expect(MusicTheory.octaveOf(69)).toBe(4);
    expect(MusicTheory.pitchClass(69)).toBe(9);
  });

  it('builds a G major signature that alters F', () => {
    const key = MusicTheory.keyByFifths(1);
    expect(key.id).toBe('G');
    expect(key.alterations.F).toBe(1);
    expect(key.alterations.C).toBeUndefined();
    expect(key.label).toContain('升号');
  });

  it('hides signature accidentals and prints naturals that cancel them', () => {
    const gMajor = MusicTheory.keyByFifths(1);
    const fSharp = MusicTheory.spell(66, gMajor, 'mixed');
    expect(fSharp.step).toBe('F');
    expect(fSharp.accidental).toBe(1);
    expect(fSharp.printedAccidental).toBeNull();
    expect(MusicTheory.vexflowKey(fSharp)).toBe('f/4');

    const fNatural = MusicTheory.spell(65, gMajor, 'mixed');
    expect(fNatural.printedAccidental).toBe('n');

    const cSharp = MusicTheory.spell(61, gMajor, 'mixed');
    expect(cSharp.step).toBe('C');
    expect(cSharp.printedAccidental).toBe('#');
  });

  it('spells Bb as diatonic in F major and cancels it with a natural', () => {
    const fMajor = MusicTheory.keyByFifths(-1);
    const bFlat = MusicTheory.spell(70, fMajor, 'mixed');
    expect(bFlat.step).toBe('B');
    expect(bFlat.accidental).toBe(-1);
    expect(bFlat.printedAccidental).toBeNull();

    const bNatural = MusicTheory.spell(71, fMajor, 'mixed');
    expect(bNatural.printedAccidental).toBe('n');
  });

  it('prefers flats when the key and mode ask for them', () => {
    const cMajor = MusicTheory.keyByFifths(0);
    const asFlat = MusicTheory.spell(61, cMajor, 'flats');
    expect(MusicTheory.formatName(asFlat, false)).toBe('D♭');
    const asSharp = MusicTheory.spell(61, cMajor, 'sharps');
    expect(MusicTheory.formatName(asSharp, false)).toBe('C♯');
  });

  it('knows diatonic pitch classes and clef windows', () => {
    const dMajor = MusicTheory.keyByFifths(2);
    expect(MusicTheory.isDiatonic(6, dMajor)).toBe(true);
    expect(MusicTheory.isDiatonic(5, dMajor)).toBe(false);
    expect(MusicTheory.clefWindow('alto').low).toBeLessThan(MusicTheory.clefWindow('alto').high);
    expect(MusicTheory.clefLabel('tenor')).toBe('次中音谱号');
  });
});
