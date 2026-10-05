import { useCallback, useEffect, useRef, useState } from 'react';
import { PianoSynth } from '@/audio/synth';
import { MusicTheory } from '@/music/theory';
import { PracticePresets } from '@/music/presets';
import { ExerciseGenerator } from '@/music/exercise';
import type { LifetimeStats, PracticeSettings } from '@/music/types';
import { PracticeRound, type RoundSnapshot, type RoundTransition } from '@/session/practice-round';
import { ProgressStore } from '@/storage/progress';

export type PracticePhase = RoundSnapshot['phase'];

export interface PracticeController {
  settings: PracticeSettings;
  lifetime: LifetimeStats;
  exercise: RoundSnapshot['exercise'];
  phase: PracticePhase;
  entered: number[];
  grade: RoundSnapshot['grade'];
  score: RoundSnapshot['score'];
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
  const [round, setRound] = useState(() => PracticeRound.create(ProgressStore.loadSettings(), Math.random, Date.now()));
  const [now, setNow] = useState(() => Date.now());

  const settingsRef = useRef(settings);
  const roundRef = useRef(round);
  const advanceTimer = useRef<number | null>(null);
  const synth = useRef(new PianoSynth());

  const clearAdvance = () => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const publish = useCallback((snapshot: RoundSnapshot) => {
    roundRef.current = snapshot;
    setRound(snapshot);
    setNow(Date.now());
  }, []);

  const advance = useCallback(() => {
    clearAdvance();
    const current = roundRef.current;
    const next = PracticeRound.advance(current, settingsRef.current, Math.random, Date.now());
    if (current.phase === 'feedback' && next.phase === 'summary') {
      setLifetime(ProgressStore.completeSession());
    }
    publish(next);
  }, [publish]);

  const playFeedback = useCallback((transition: RoundTransition) => {
    if (!settingsRef.current.sound || transition.effect === 'none' || transition.effect === 'partial') return;
    synth.current.resume();
    const notes = transition.snapshot.exercise.notes.map((note) => note.midi);
    if (transition.effect === 'correct') {
      synth.current.playChord(notes);
      return;
    }
    if (transition.playedPitchClass !== null) {
      const anchor = notes[0] ?? 60;
      synth.current.play(MusicTheory.nearestMidi(transition.playedPitchClass, anchor), 0.25);
    }
    window.setTimeout(() => {
      if (settingsRef.current.sound) synth.current.playChord(notes);
    }, 220);
  }, []);

  const applyTransition = useCallback(
    (transition: RoundTransition) => {
      if (transition.effect === 'none') return;
      publish(transition.snapshot);
      if (transition.effect === 'partial') {
        const match = transition.snapshot.exercise.notes.find(
          (note) => MusicTheory.pitchClass(note.midi) === transition.playedPitchClass,
        );
        if (match && settingsRef.current.sound) {
          synth.current.resume();
          synth.current.play(match.midi);
        }
        return;
      }
      const grade = transition.snapshot.grade;
      if (grade) {
        setLifetime(ProgressStore.recordAttempt(grade, transition.snapshot.score.bestStreak, transition.miss));
      }
      playFeedback(transition);
      if (transition.effect === 'correct') {
        advanceTimer.current = window.setTimeout(() => advance(), 720);
      }
    },
    [advance, playFeedback, publish],
  );

  const answer = useCallback(
    (pitchClass: number) => {
      applyTransition(PracticeRound.input(roundRef.current, settingsRef.current, pitchClass, Date.now()));
    },
    [applyTransition],
  );

  const reveal = useCallback(() => {
    applyTransition(PracticeRound.reveal(roundRef.current, settingsRef.current, Date.now()));
  }, [applyTransition]);

  const restart = useCallback(
    (nextSettings?: PracticeSettings) => {
      clearAdvance();
      const active = ExerciseGenerator.normalize(nextSettings ?? settingsRef.current);
      settingsRef.current = active;
      setSettings(active);
      ProgressStore.saveSettings(active);
      publish(PracticeRound.create(active, Math.random, Date.now()));
    },
    [publish],
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
    if (round.phase !== 'question' || !settings.timed) return;
    const id = window.setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      if (roundRef.current.phase !== 'question') return;
      if (currentNow - roundRef.current.startedAt >= settingsRef.current.timeoutMs) {
        applyTransition(PracticeRound.timeout(roundRef.current, settingsRef.current, currentNow));
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [applyTransition, round.exercise.id, round.phase, settings.timed]);

  useEffect(() => () => clearAdvance(), []);

  return {
    settings,
    lifetime,
    exercise: round.exercise,
    phase: round.phase,
    entered: round.entered,
    grade: round.grade,
    score: round.score,
    now,
    questionStartedAt: round.startedAt,
    answer,
    reveal,
    advance,
    restart: () => restart(),
    applyPreset,
    updateSettings,
    setSound,
  };
}
