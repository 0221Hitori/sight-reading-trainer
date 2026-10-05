import { ExerciseGenerator, ExerciseView } from '@/music/exercise';
import { MusicTheory } from '@/music/theory';
import { AnswerChecker, SessionScore } from '@/music/scoring';
import type { Exercise, Grade, MissRecord, PracticeSettings } from '@/music/types';

export type RoundPhase = 'question' | 'feedback' | 'summary';
export type RoundEffect = 'none' | 'partial' | 'correct' | 'wrong' | 'timeout' | 'reveal';

export interface RoundSnapshot {
  phase: RoundPhase;
  exercise: Exercise;
  entered: number[];
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
 * Pure practice state machine. The React hook applies sound and localStorage
 * after these transitions; it does not decide whether an answer is right.
 */
export class PracticeRound {
  static create(settings: PracticeSettings, rng: () => number, now: number): RoundSnapshot {
    return {
      phase: 'question',
      exercise: ExerciseGenerator.next(settings, rng),
      entered: [],
      grade: null,
      score: SessionScore.empty(),
      startedAt: now,
    };
  }

  static input(
    snapshot: RoundSnapshot,
    settings: PracticeSettings,
    pitchClass: number,
    now: number,
  ): RoundTransition {
    if (snapshot.phase !== 'question') return this.idle(snapshot);
    const target = AnswerChecker.targetClasses(snapshot.exercise.notes.map((note) => note.midi));
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

  static advance(snapshot: RoundSnapshot, settings: PracticeSettings, rng: () => number, now: number): RoundSnapshot {
    if (snapshot.phase !== 'feedback') return snapshot;
    if (snapshot.score.attempts >= settings.sessionLength) {
      return { ...snapshot, phase: 'summary' };
    }
    return {
      ...snapshot,
      phase: 'question',
      exercise: ExerciseGenerator.next(settings, rng),
      entered: [],
      grade: null,
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
    const target = AnswerChecker.targetClasses(snapshot.exercise.notes.map((note) => note.midi));
    const matched = entered.filter((pitchClass) => target.includes(pitchClass));
    const outstanding = snapshot.exercise.notes.filter(
      (note) => !matched.includes(MusicTheory.pitchClass(note.midi)),
    );
    const miss = grade.correct ? null : this.describeMiss(snapshot.exercise, grade, playedPitchClass, outstanding, settings);
    const effect: RoundEffect =
      grade.reason === 'match' ? 'correct' : grade.reason === 'timeout' ? 'timeout' : grade.reason === 'reveal' ? 'reveal' : 'wrong';
    return {
      snapshot: {
        ...snapshot,
        phase: 'feedback',
        entered,
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
    grade: Grade,
    playedPitchClass: number | null,
    outstanding: Exercise['notes'],
    settings: PracticeSettings,
  ): MissRecord {
    const names = ExerciseView.letterNames(outstanding.length > 0 ? outstanding : exercise.notes);
    let playedLabel = '超时';
    if (grade.reason === 'reveal') playedLabel = '看答案';
    else if (grade.reason === 'wrong' && playedPitchClass !== null) {
      playedLabel = MusicTheory.formatPitchClass(playedPitchClass, exercise.key, settings.accidentalMode);
    }
    return {
      expectedLabel: ExerciseView.answerLabel(exercise.notes),
      playedLabel,
      noteNames: names,
      clefLabel: MusicTheory.clefShort(exercise.clef),
    };
  }

  private static idle(snapshot: RoundSnapshot): RoundTransition {
    return { snapshot, effect: 'none', miss: null, playedPitchClass: null };
  }
}
