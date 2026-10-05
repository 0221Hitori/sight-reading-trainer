/**
 * @vitest-environment jsdom
 *
 * VexFlow 5 paints clefs and noteheads with a music font (SVG text) and
 * staff / ledger lines as paths. jsdom has no FontFace, so this file stubs
 * the loader. Glyph metrics stay empty; the assertions check structure.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ExerciseGenerator } from '@/music/exercise';
import { PracticePresets } from '@/music/presets';
import { StaffRenderer } from '@/notation/staff-renderer';
import type { Clef, Exercise, PracticeSettings } from '@/music/types';

class FontFaceStub {
  status = 'unloaded';
  family: string;
  constructor(family: string) {
    this.family = family;
  }
  load(): Promise<this> {
    this.status = 'loaded';
    return Promise.resolve(this);
  }
}

if (typeof globalThis.FontFace === 'undefined') {
  Object.defineProperty(globalThis, 'FontFace', { value: FontFaceStub, configurable: true });
}

function draw(exercise: Exercise, width = 640): SVGElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  StaffRenderer.draw(host, exercise, { entered: [], grade: null, width });
  const svg = host.querySelector('svg');
  if (!(svg instanceof SVGElement)) throw new Error('StaffRenderer did not emit an svg');
  return svg;
}

describe('StaffRenderer', () => {
  beforeAll(async () => {
    HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
      if (type !== '2d') return null;
      return {
        font: '',
        measureText(text: string) {
          return {
            width: Math.max(8, text.length * 12),
            actualBoundingBoxAscent: 20,
            actualBoundingBoxDescent: 4,
            fontBoundingBoxAscent: 24,
            fontBoundingBoxDescent: 6,
          };
        },
      } as unknown as CanvasRenderingContext2D;
    } as typeof HTMLCanvasElement.prototype.getContext;
    await StaffRenderer.ensureFonts();
  });

  it('draws five staff lines plus a clef and a notehead for every clef', () => {
    for (const clef of ['treble', 'bass', 'alto', 'tenor'] as const) {
      const settings: PracticeSettings = {
        ...PracticePresets.apply('advanced', false),
        clefs: [clef],
        chordSizeMin: clef === 'treble' ? 3 : 1,
        chordSizeMax: clef === 'treble' ? 3 : 1,
        accidentalMode: clef === 'bass' ? 'flats' : 'sharps',
        minFifths: clef === 'bass' ? -2 : 1,
        maxFifths: clef === 'bass' ? -1 : 2,
        chromaticProbability: clef === 'alto' ? 1 : 0,
      };
      const exercise = ExerciseGenerator.next(settings, () => 0.4);
      const svg = draw(exercise);
      const linePaths = [...svg.querySelectorAll('path')].filter((path) => (path.getAttribute('d') ?? '').includes('L'));
      expect(linePaths.length, `${clef} staff lines`).toBeGreaterThanOrEqual(5);
      const glyphs = [...svg.querySelectorAll('text')]
        .map((node) => node.textContent ?? '')
        .join('');
      expect(glyphs.length, `${clef} glyphs`).toBeGreaterThan(0);
      expect(svg.getAttribute('viewBox') ?? '').toMatch(/^0 0 \d+ 270$/);
      expect(svg.getAttribute('width')).toBe('100%');
    }
  });

  it('adds ledger-line paths for a note below the treble staff', () => {
    const base = {
      id: 'mid',
      clef: 'treble' as Clef,
      key: { id: 'C', fifths: 0, alterations: {}, label: 'C 大调' },
    };
    const onStaff = draw({
      ...base,
      notes: [{ midi: 64, step: 'E', accidental: 0, octave: 4, printedAccidental: null }],
    });
    const below = draw({
      ...base,
      id: 'ledger',
      notes: [{ midi: 57, step: 'A', accidental: 0, octave: 3, printedAccidental: null }],
    });
    const count = (svg: SVGElement) => svg.querySelectorAll('path').length;
    expect(below.getAttribute('viewBox') ?? '').toMatch(/^0 0 /);
    expect(count(below)).toBeGreaterThan(count(onStaff));
  });
});