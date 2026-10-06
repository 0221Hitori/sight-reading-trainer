import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import VexFlow from 'vexflow';
import type { Exercise } from '@/music/types';
import { MusicTheory } from '@/music/theory';

const INK = '#1c1915';
const PINE = '#1f6b45';
const CINNABAR = '#9d3418';
/** 当前还没答完的音。和已答对的绿、答错的红分开。 */
const CURRENT = '#1d4e89';

export interface StaffRenderOptions {
  /** 正在答的位置。 */
  cursor: number;
  entered: readonly number[];
  /** 与 slots 等长。还没答的是 null。 */
  marks: readonly ({ correct: boolean } | null)[];
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
    const slotCount = Math.max(1, exercise.slots.length);
    // 音多时加宽 viewBox，再缩进容器，避免符头挤在一起。
    const width = Math.max(320, slotCount * 72, Math.floor(options.width || 320));
    const height = 270;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    // y = 92、画布高 270，给上下加线留空，避免符头贴边。
    const stave = new Stave(12, 92, width - 24);
    stave.addClef(exercise.clef);
    if (exercise.key.fifths !== 0) stave.addKeySignature(exercise.key.id);
    stave.setContext(context).draw();

    // 四分音符只用来把一行排开。判分不看时值。
    const tickables = exercise.slots.map((slot, slotIndex) => {
      const staveNote = new StaveNote({
        clef: exercise.clef,
        keys: slot.notes.map((note) => MusicTheory.vexflowKey(note)),
        duration: 'q',
      });
      const mark = options.marks[slotIndex] ?? null;
      const tone = this.toneFor(slotIndex, mark, options);
      if (tone) {
        staveNote.setStyle({ fillStyle: tone, strokeStyle: tone });
        staveNote.setLedgerLineStyle({ fillStyle: tone, strokeStyle: tone });
      }
      slot.notes.forEach((note, index) => {
        if (note.printedAccidental) {
          staveNote.addModifier(new Accidental(note.printedAccidental), index);
        }
        const pitchClass = MusicTheory.pitchClass(note.midi);
        const color = this.colorFor(slotIndex, pitchClass, mark, options);
        staveNote.setKeyStyle(index, { fillStyle: color, strokeStyle: color });
      });
      return staveNote;
    });

    const voice = new Voice({ numBeats: slotCount, beatValue: 4 });
    voice.addTickables(tickables);
    const available = Math.max(72, stave.getNoteEndX() - stave.getNoteStartX() - 16);
    new Formatter().joinVoices([voice]).format([voice], available);
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

  /** 已答的格子整音染色。当前音在没有逐个符头颜色时也染成高亮色。还没轮到的音保持墨色。 */
  private static toneFor(
    slotIndex: number,
    mark: { correct: boolean } | null,
    options: StaffRenderOptions,
  ): string | null {
    if (mark?.correct === true) return PINE;
    if (mark && !mark.correct) return CINNABAR;
    if (slotIndex === options.cursor) return CURRENT;
    return null;
  }

  /**
   * 已答对的音是绿色，答错是朱色。
   * 当前音高亮；和弦里已经按对的音级先变绿。后面的音保持墨色，方便提前看。
   */
  private static colorFor(
    slotIndex: number,
    pitchClass: number,
    mark: { correct: boolean } | null,
    options: StaffRenderOptions,
  ): string {
    if (mark?.correct === true) return PINE;
    if (mark && !mark.correct) return CINNABAR;
    if (slotIndex === options.cursor) {
      if (options.entered.includes(pitchClass)) return PINE;
      return CURRENT;
    }
    return INK;
  }
}
