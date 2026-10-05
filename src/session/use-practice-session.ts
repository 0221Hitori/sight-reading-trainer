import { useCallback, useEffect, useRef, useState } from 'react';
import { PianoSynth } from '@/audio/synth';
import { ExerciseGenerator, ExerciseView } from '@/music/exercise';
import { MusicTheory } from '@/music/theory';
import { PracticePresets } from '@/music/presets';
import { AnswerChecker, SessionScore } from '@/music/scoring';
import type { Exercise, Grade, LifetimeStats, MissRecord, PracticeSettings } from '@/music/types';
import { ProgressStore } from '@/storage/progress';

export type PracticePhase = 'question' | 'feedback' | 'summary';

export interface PracticeController {
  settings: PracticeSettings;
  lifetime: LifetimeStats;
  exercise: Exercise;
  phase: PracticePhase;
  entered: number[];
  grade: Grade | null;
  score: SessionScore;
  now: number;
  questionStartedAt: number;
  answer: (pitchClass: number) => void;
  reveal: () => void;
  advance: () => void;
  restart: () => void;
  applyPreset: (presetId: string) => void;
  updateSettings: (patch: Partial<PracticeSettings>) => void;
  setSound: (sound: boolean) => void;
}

export function usePracticeSession(): PracticeController {
  const [settings, setSettings] = useState(() => ProgressStore.loadSettings());
  const [lifetime, setLifetime] = useState(() => ProgressStore.loadStats());
  const [exercise, setExercise] = useState(() => ExerciseGenerator.next(ProgressStore.loadSettings()));
  const [phase, setPhase] = useState<PracticePhase>('question');
  const [entered, setEntered] = useState<number[]>([]);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [score, setScore] = useState(() => SessionScore.empty());
  const [now, setNow] = useState(() => Date.now());
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());

  const settingsRef = useRef(settings);
  const exerciseRef = useRef(exercise);
  const enteredRef = useRef(entered);
  const phaseRef = useRef(phase);
  const scoreRef = useRef(score);
  const startedRef = useRef(questionStartedAt);
  const advanceTimer = useRef<number | null>(null);
  const synth = useRef(new PianoSynth());

  const clearAdvance = () => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const startQuestion = useCallback((nextExercise: Exercise) => {
    const started = Date.now();
    startedRef.current = started;
    exerciseRef.current = nextExercise;
    enteredRef.current = [];
    phaseRef.current = 'question';
    setExercise(nextExercise);
    setEntered([]);
    setGrade(null);
    setPhase('question');
    setQuestionStartedAt(started);
    setNow(started);
  }, []);

  const advance = useCallback(() => {
    clearAdvance();
    if (phaseRef.current !== 'feedback') return;
    if (scoreRef.current.attempts >= settingsRef.current.sessionLength) {
      phaseRef.current = 'summary';
      setPhase('summary');
      setLifetime(ProgressStore.completeSession());
      return;
    }
    startQuestion(ExerciseGenerator.next(settingsRef.current));
  }, [startQuestion]);

  const resolve = useCallback(
    (nextGrade: Grade, playedPitchClass: number | null) => {
      if (phaseRef.current !== 'question') return;
      phaseRef.current = 'feedback';
      const currentExercise = exerciseRef.current;
      const currentEntered = enteredRef.current;
      const responseMs = Date.now() - startedRef.current;
      const target = AnswerChecker.targetClasses(currentExercise.notes.map((note) => note.midi));
      const matched = currentEntered.filter((pitchClass) => target.includes(pitchClass));
      const outstanding = currentExercise.notes.filter(
        (note) => !matched.includes(MusicTheory.pitchClass(note.midi)),
      );
      const miss = nextGrade.correct
        ? null
        : buildMiss(currentExercise, nextGrade, playedPitchClass, outstanding, settingsRef.current);
      const nextScore = scoreRef.current.record(nextGrade, responseMs, miss);
      scoreRef.current = nextScore;
      setScore(nextScore);
      setGrade(nextGrade);
      setPhase('feedback');
      setLifetime(ProgressStore.recordAttempt(nextGrade, nextScore.bestStreak, miss));

      if (settingsRef.current.sound) {
        synth.current.resume();
        if (nextGrade.correct) {
          synth.current.playChord(currentExercise.notes.map((note) => note.midi));
        } else if (playedPitchClass !== null) {
          const anchor = currentExercise.notes[0]?.midi ?? 60;
          synth.current.play(MusicTheory.nearestMidi(playedPitchClass, anchor), 0.28);
        }
      }

      if (nextGrade.correct) {
        advanceTimer.current = window.setTimeout(() => advance(), 720);
      }
    },
    [advance],
  );

  const answer = useCallback(
    (pitchClass: number) => {
      if (phaseRef.current !== 'question') return;
      const current = exerciseRef.current;
      const target = AnswerChecker.targetClasses(current.notes.map((note) => note.midi));
      const result = AnswerChecker.applyPitchClass(target, enteredRef.current, pitchClass);
      enteredRef.current = result.entered;
      setEntered(result.entered);
      if (!result.grade) {
        const match = current.notes.find((note) => MusicTheory.pitchClass(note.midi) === pitchClass);
        if (match && settingsRef.current.sound) {
          synth.current.resume();
          synth.current.play(match.midi);
        }
        return;
      }
      resolve(result.grade, pitchClass);
    },
    [resolve],
  );

  const reveal = useCallback(() => {
    resolve(AnswerChecker.reveal(), null);
  }, [resolve]);

  const restart = useCallback(
    (nextSettings?: PracticeSettings) => {
      clearAdvance();
      const active = ExerciseGenerator.normalize(nextSettings ?? settingsRef.current);
      settingsRef.current = active;
      setSettings(active);
      ProgressStore.saveSettings(active);
      const empty = SessionScore.empty();
      scoreRef.current = empty;
      setScore(empty);
      startQuestion(ExerciseGenerator.next(active));
    },
    [startQuestion],
  );

  const commit = useCallback(
    (next: PracticeSettings, restartSession: boolean) => {
      const normalized = ExerciseGenerator.normalize(next);
      settingsRef.current = normalized;
      setSettings(normalized);
      ProgressStore.saveSettings(normalized);
      if (restartSession) restart(normalized);
    },
    [restart],
  );

  const applyPreset = useCallback(
    (presetId: string) => {
      commit(PracticePresets.apply(presetId, settingsRef.current.sound), true);
    },
    [commit],
  );

  const updateSettings = useCallback(
    (patch: Partial<PracticeSettings>) => {
      commit({ ...settingsRef.current, ...patch, presetId: 'custom' }, false);
    },
    [commit],
  );

  const setSound = useCallback(
    (sound: boolean) => {
      commit({ ...settingsRef.current, sound }, false);
    },
    [commit],
  );

  useEffect(() => {
    if (phase !== 'question' || !settings.timed) return;
    const id = window.setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      if (phaseRef.current !== 'question') return;
      if (currentNow - startedRef.current >= settingsRef.current.timeoutMs) {
        resolve(AnswerChecker.timeout(), null);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, exercise.id, settings.timed, resolve]);

  useEffect(() => () => clearAdvance(), []);

  return {
    settings,
    lifetime,
    exercise,
    phase,
    entered,
    grade,
    score,
    now,
    questionStartedAt,
    answer,
    reveal,
    advance,
    restart: () => restart(),
    applyPreset,
    updateSettings,
    setSound,
  };
}

function buildMiss(
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
