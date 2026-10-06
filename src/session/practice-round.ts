import { ExerciseGenerator, ExerciseView } from '@/music/exercise';
import { MusicTheory } from '@/music/theory';
import { AnswerChecker, SessionScore } from '@/music/scoring';
import type { Exercise, Grade, GradeReason, MissRecord, PracticeSettings } from '@/music/types';

export type RoundPhase = 'question' | 'feedback' | 'summary';
export type RoundEffect = 'none' | 'partial' | 'correct' | 'wrong' | 'timeout' | 'reveal';

/** 一行里已经答过的位置。还没答的格子在 snapshot 里是 null。 */
export interface SlotMark {
  correct: boolean;
  reason: GradeReason;
}

export interface RoundSnapshot {
  phase: RoundPhase;
  exercise: Exercise;
  /** 当前要答的位置。反馈阶段仍指向刚答完的那一格。 */
  cursor: number;
  entered: number[];
  marks: (SlotMark | null)[];
  grade: Grade | null;
  score: SessionScore;
  startedAt: number;
}

export interface RoundTransition {
  snapshot: RoundSnapshot;
  effect: RoundEffect;
  miss: MissRecord | null;
  playedPitchClass: number | null;
}

/**
 * 纯练习状态机：一行里从左到右答题，答完再换行。
 * React hook 只在转移之后发声和写 localStorage，不在这里决定对错。
 * 重复按键返回同一个 snapshot 引用，effect 为 `none`，方便调用方跳过副作用。
 */
export class PracticeRound {
  /** 答对后自动进入下一个音的等待。答错的等待在设置里。 */
  static readonly correctAdvanceMs = 720;

  static create(settings: PracticeSettings, rng: () => number, now: number): RoundSnapshot {
    return this.openLine(settings, rng, now, SessionScore.empty(), settings.sessionLength);
  }

  /** 答对等 `correctAdvanceMs`，答错等 `wrongAdvanceMs`。超时和看答案仍由用户翻题。 */
  static advanceDelay(effect: RoundEffect, settings: PracticeSettings): number | null {
    if (effect === 'correct') return this.correctAdvanceMs;
    if (effect === 'wrong') return settings.wrongAdvanceMs;
    return null;
  }

  static input(
    snapshot: RoundSnapshot,
    settings: PracticeSettings,
    pitchClass: number,
    now: number,
  ): RoundTransition {
    if (snapshot.phase !== 'question') return this.idle(snapshot);
    const slot = ExerciseView.slot(snapshot.exercise, snapshot.cursor);
    const target = AnswerChecker.targetClasses(slot.notes.map((note) => note.midi));
    const result = AnswerChecker.applyPitchClass(target, snapshot.entered, pitchClass);
    if (!result.grade) {
      if (result.entered.length === snapshot.entered.length) return this.idle(snapshot);
      return {
        snapshot: { ...snapshot, entered: result.entered },
        effect: 'partial',
        miss: null,
        playedPitchClass: pitchClass,
      };
    }
    return this.finish(snapshot, settings, result.grade, result.entered, pitchClass, now);
  }

  static timeout(snapshot: RoundSnapshot, settings: PracticeSettings, now: number): RoundTransition {
    if (snapshot.phase !== 'question') return this.idle(snapshot);
    return this.finish(snapshot, settings, AnswerChecker.timeout(), snapshot.entered, null, now);
  }

  static reveal(snapshot: RoundSnapshot, settings: PracticeSettings, now: number): RoundTransition {
    if (snapshot.phase !== 'question') return this.idle(snapshot);
    return this.finish(snapshot, settings, AnswerChecker.reveal(), snapshot.entered, null, now);
  }

  /**
   * 反馈结束之后往前走。
   * 这一行还有位置就只移动游标；整行答完才出新的一行。本轮题数用尽则进入小结。
   */
  static advance(snapshot: RoundSnapshot, settings: PracticeSettings, rng: () => number, now: number): RoundSnapshot {
    if (snapshot.phase !== 'feedback') return snapshot;
    if (snapshot.score.attempts >= settings.sessionLength) {
      return { ...snapshot, phase: 'summary' };
    }
    const nextCursor = snapshot.cursor + 1;
    if (nextCursor < snapshot.exercise.slots.length) {
      return {
        ...snapshot,
        phase: 'question',
        cursor: nextCursor,
        entered: [],
        grade: null,
        startedAt: now,
      };
    }
    return this.openLine(settings, rng, now, snapshot.score, settings.sessionLength - snapshot.score.attempts);
  }

  private static openLine(
    settings: PracticeSettings,
    rng: () => number,
    now: number,
    score: SessionScore,
    remaining: number,
  ): RoundSnapshot {
    const exercise = ExerciseGenerator.next(settings, rng, remaining);
    return {
      phase: 'question',
      exercise,
      cursor: 0,
      entered: [],
      marks: exercise.slots.map(() => null),
      grade: null,
      score,
      startedAt: now,
    };
  }

  private static finish(
    snapshot: RoundSnapshot,
    settings: PracticeSettings,
    grade: Grade,
    entered: number[],
    playedPitchClass: number | null,
    now: number,
  ): RoundTransition {
    const responseMs = now - snapshot.startedAt;
    const slot = ExerciseView.slot(snapshot.exercise, snapshot.cursor);
    const target = AnswerChecker.targetClasses(slot.notes.map((note) => note.midi));
    const matched = entered.filter((pitchClass) => target.includes(pitchClass));
    const outstanding = slot.notes.filter((note) => !matched.includes(MusicTheory.pitchClass(note.midi)));
    // 错题音名只记这一格还没对上的音，和弦里已经按对的音不重复记错。
    const miss = grade.correct
      ? null
      : this.describeMiss(snapshot.exercise, slot.notes, grade, playedPitchClass, outstanding, settings);
    const effect: RoundEffect =
      grade.reason === 'match' ? 'correct' : grade.reason === 'timeout' ? 'timeout' : grade.reason === 'reveal' ? 'reveal' : 'wrong';
    const marks = snapshot.marks.slice();
    marks[snapshot.cursor] = { correct: grade.correct, reason: grade.reason };
    return {
      snapshot: {
        ...snapshot,
        phase: 'feedback',
        entered,
        marks,
        grade,
        score: snapshot.score.record(grade, responseMs, miss),
      },
      effect,
      miss,
      playedPitchClass,
    };
  }

  private static describeMiss(
    exercise: Exercise,
    slotNotes: Exercise['slots'][number]['notes'],
    grade: Grade,
    playedPitchClass: number | null,
    outstanding: Exercise['slots'][number]['notes'],
    settings: PracticeSettings,
  ): MissRecord {
    // 谱面答案写整格。累计混淆只记还没对上的音；一音未中时就是整格。
    const names = ExerciseView.letterNames(outstanding.length > 0 ? outstanding : slotNotes);
    // 超时、看答案、按错各有标签。按错时按当前调号拼出你按的音级。
    let playedLabel = '超时';
    if (grade.reason === 'reveal') playedLabel = '看答案';
    else if (grade.reason === 'wrong' && playedPitchClass !== null) {
      playedLabel = MusicTheory.formatPitchClass(playedPitchClass, exercise.key, settings.accidentalMode);
    }
    return {
      expectedLabel: ExerciseView.answerLabel(slotNotes),
      playedLabel,
      noteNames: names,
      clefLabel: MusicTheory.clefShort(exercise.clef),
    };
  }

  private static idle(snapshot: RoundSnapshot): RoundTransition {
    return { snapshot, effect: 'none', miss: null, playedPitchClass: null };
  }
}
