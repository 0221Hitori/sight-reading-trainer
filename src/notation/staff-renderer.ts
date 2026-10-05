import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import VexFlow from 'vexflow';
import type { Exercise, Grade } from '@/music/types';
import { MusicTheory } from '@/music/theory';

const INK = '#1c1915';
const PINE = '#1f6b45';
const CINNABAR = '#9d3418';

export interface StaffRenderOptions {
  entered: readonly number[];
  grade: Grade | null;
  width: number;
}

/** Draws one exercise onto an empty host element using VexFlow's SVG backend. */
export class StaffRenderer {
  private static fonts: Promise<void> | null = null;

  static ensureFonts(): Promise<void> {
    if (!this.fonts) {
      this.fonts = VexFlow.loadFonts('Bravura', 'Academico').then(() => {
        VexFlow.setFonts('Bravura', 'Academico');
      });
    }
    return this.fonts;
  }

  static draw(host: HTMLDivElement, exercise: Exercise, options: StaffRenderOptions): void {
    host.replaceChildren();
    const width = Math.max(320, Math.floor(options.width));
    const height = 250;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    const stave = new Stave(12, 78, width - 24);
    stave.addClef(exercise.clef);
    if (exercise.key.fifths !== 0) stave.addKeySignature(exercise.key.id);
    stave.setContext(context).draw();

    const staveNote = new StaveNote({
      clef: exercise.clef,
      keys: exercise.notes.map((note) => MusicTheory.vexflowKey(note)),
      duration: 'w',
    });

    exercise.notes.forEach((note, index) => {
      if (note.printedAccidental) {
        staveNote.addModifier(new Accidental(note.printedAccidental), index);
      }
      const pitchClass = MusicTheory.pitchClass(note.midi);
      staveNote.setKeyStyle(index, { fillStyle: this.colorFor(pitchClass, options), strokeStyle: this.colorFor(pitchClass, options) });
    });

    if (options.grade?.correct === true) {
      staveNote.setLedgerLineStyle({ fillStyle: PINE, strokeStyle: PINE });
    } else if (options.grade && !options.grade.correct) {
      staveNote.setLedgerLineStyle({ fillStyle: CINNABAR, strokeStyle: CINNABAR });
    }

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.addTickable(staveNote);
    const available = Math.max(72, stave.getNoteEndX() - stave.getNoteStartX() - 16);
    // Keep a single flashcard note near the clef instead of justifying it to the barline.
    new Formatter().joinVoices([voice]).format([voice], Math.min(150, available));
    voice.draw(context, stave);

    const svg = host.querySelector('svg');
    if (svg instanceof SVGElement) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', String(height));
      svg.style.display = 'block';
      svg.style.maxWidth = '100%';
      svg.setAttribute('aria-hidden', 'true');
    }
  }

  private static colorFor(pitchClass: number, options: StaffRenderOptions): string {
    if (options.grade?.correct === true) return PINE;
    if (options.grade && !options.grade.correct) return CINNABAR;
    if (options.entered.includes(pitchClass)) return PINE;
    return INK;
  }
}
