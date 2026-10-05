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

/**
 * 用 VexFlow 的 SVG 后端把一道题画进空的宿主元素。
 * 谱号和符头是音乐字体里的字符，谱线和加线是 path。
 * 每次 draw 都新建 Renderer：SVGContext.resize 会累乘缩放。
 */
export class StaffRenderer {
  private static fonts: Promise<void> | null = null;

  /** 加载 Bravura（谱号、符头）和 Academico。失败时清掉缓存，下次可以重试。 */
  static ensureFonts(): Promise<void> {
    if (!this.fonts) {
      this.fonts = VexFlow.loadFonts('Bravura', 'Academico')
        .then(() => {
          VexFlow.setFonts('Bravura', 'Academico');
        })
        .catch((error: unknown) => {
          this.fonts = null;
          throw error;
        });
    }
    return this.fonts;
  }

  static draw(host: HTMLDivElement, exercise: Exercise, options: StaffRenderOptions): void {
    host.replaceChildren();
    const width = Math.max(280, Math.floor(options.width || 320));
    const height = 270;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    // y = 92、画布高 270，给上下加线留空，避免符头贴边。
    const stave = new Stave(12, 92, width - 24);
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
    // 识谱卡片把音符留在谱号旁边，不把它撑到小节线。
    new Formatter().joinVoices([voice]).format([voice], Math.min(150, available));
    voice.draw(context, stave);

    const svg = host.querySelector('svg');
    if (svg instanceof SVGElement) {
      // viewBox 让谱面随容器缩放，窄屏不会被裁成半截。
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', String(height));
      svg.style.display = 'block';
      svg.style.maxWidth = '100%';
      svg.setAttribute('aria-hidden', 'true');
    }
  }

  /** 未判分时，已经按对的和弦音变绿；整题判错则全部变红。 */
  private static colorFor(pitchClass: number, options: StaffRenderOptions): string {
    if (options.grade?.correct === true) return PINE;
    if (options.grade && !options.grade.correct) return CINNABAR;
    if (options.entered.includes(pitchClass)) return PINE;
    return INK;
  }
}
