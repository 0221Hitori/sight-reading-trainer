import { useEffect, useState } from 'react';
import { ExerciseView } from '@/music/exercise';
import { KeyboardMap } from '@/music/keyboard';
import { MusicTheory } from '@/music/theory';
import { PracticePresets } from '@/music/presets';
import { SessionScore } from '@/music/scoring';
import { MidiPorts, type MidiStatus } from '@/midi/midi-ports';
import { usePracticeSession } from '@/session/use-practice-session';
import { HelpDialog } from '@/components/HelpDialog';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { SessionSummary } from '@/components/SessionSummary';
import { SettingsPanel } from '@/components/SettingsPanel';
import { StaffView } from '@/components/StaffView';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** 练习主界面。键盘、屏幕钢琴和 MIDI 都把音级交给 session.answer。 */
export function PracticeApp() {
  const session = usePracticeSession();
  const [held, setHeld] = useState<number[]>([]);
  const [midi, setMidi] = useState<MidiStatus>(() => MidiPorts.idleStatus());
  const [midiPorts] = useState(() => new MidiPorts());

  const {
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
    restart,
    applyPreset,
    updateSettings,
    setSound,
  } = session;

  useEffect(() => {
    // event.code 是物理键。长按连发、正在输入、帮助对话框打开时不抢键。
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTyping(event.target) || document.querySelector('[role="dialog"]')) return;
      const pitchClass = KeyboardMap.pitchClassFromCode(event.code);
      if (pitchClass !== null && phase === 'question') {
        event.preventDefault();
        setHeld((current) => (current.includes(pitchClass) ? current : [...current, pitchClass]));
        answer(pitchClass);
        return;
      }
      if ((event.code === 'Enter' || event.code === 'Space') && phase === 'feedback') {
        // 焦点已经在按钮或链接上时不拦截，避免一次点击被当成「下一题」。
        if (event.target instanceof HTMLElement && event.target.closest('button, a')) return;
        event.preventDefault();
        advance();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const pitchClass = KeyboardMap.pitchClassFromCode(event.code);
      if (pitchClass === null) return;
      setHeld((current) => current.filter((item) => item !== pitchClass));
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [advance, answer, phase]);

  const connectMidi = async () => {
    const status = await midiPorts.connect((pitchClass) => answer(pitchClass));
    setMidi(status);
  };

  const questionNumber =
    phase === 'summary' ? settings.sessionLength : phase === 'feedback' ? score.attempts : score.attempts + 1;
  const remaining = settings.timed ? Math.max(0, settings.timeoutMs - (now - questionStartedAt)) : settings.timeoutMs;
  const answerLabel = ExerciseView.answerLabel(exercise.notes);
  const feedback = describeFeedback(phase, grade?.correct ?? null, grade?.reason ?? null, answerLabel);
  const partial =
    phase === 'question' && entered.length > 0
      ? `已确认 ${entered
          .map((pitchClass) => {
            const note = exercise.notes.find((item) => MusicTheory.pitchClass(item.midi) === pitchClass);
            return note
              ? MusicTheory.formatName(note, false)
              : MusicTheory.formatPitchClass(pitchClass, exercise.key, settings.accidentalMode);
          })
          .join(' ')}`
      : '';

  const topMisses = Object.entries(lifetime.missesByNote)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Sight reading</p>
          <h1 className="font-display text-3xl leading-tight text-balance sm:text-4xl">识谱训练工具</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            看谱上的音，按下对应琴键。按音名判断，不区分八度。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="sound-toggle" checked={settings.sound} onCheckedChange={setSound} />
            <Label htmlFor="sound-toggle">声音</Label>
          </div>
          <HelpDialog />
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-2" role="toolbar" aria-label="难度">
        {PracticePresets.list.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant={settings.presetId === preset.id ? 'default' : 'outline'}
            aria-pressed={settings.presetId === preset.id}
            onClick={() => applyPreset(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
        {settings.presetId === 'custom' && (
          <Button type="button" variant="default" aria-pressed>
            自定义
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {settings.presetId === 'custom'
          ? '自定义设置会从下一题开始生效。换预设会立刻重开一轮。'
          : (PracticePresets.list.find((preset) => preset.id === settings.presetId)?.blurb ?? '')}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="进度" value={`${Math.min(questionNumber, settings.sessionLength)} / ${settings.sessionLength}`} />
        <Stat label="连对" value={String(score.streak)} />
        <Stat label="正确率" value={score.attempts === 0 ? '—' : SessionScore.formatAccuracy(score.accuracy)} />
        <Stat label="平均用时" value={SessionScore.formatMs(score.averageResponseMs)} />
      </dl>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="staff-sheet flex min-w-0 flex-col gap-4 p-4 sm:p-6" aria-label="练习">
          {phase === 'summary' ? (
            <SessionSummary
              score={score}
              lifetime={lifetime}
              onRestart={restart}
            />
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{ExerciseView.meta(exercise)}</p>
                <p className="text-xs text-muted-foreground">第 {questionNumber} 题</p>
              </div>
              <StaffView exercise={exercise} entered={entered} grade={grade} />
              {settings.timed && phase === 'question' && (
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="剩余时间"
                  aria-valuemin={0}
                  aria-valuemax={settings.timeoutMs}
                  aria-valuenow={remaining}
                >
                  <div
                    className="h-full bg-primary transition-[width] duration-100"
                    style={{ width: `${(remaining / settings.timeoutMs) * 100}%` }}
                  />
                </div>
              )}
              <div className="min-h-14" aria-live="polite" data-testid="feedback">
                {feedback ? (
                  <div className={grade?.correct ? 'feedback-ok' : 'feedback-bad'}>
                    <p className="font-medium">{feedback.title}</p>
                    <p>{feedback.detail}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {partial || (exercise.notes.length > 1 ? '依次或同时按下和弦里的每一个音。' : '按下你看到的音。')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {phase === 'question' ? (
                  <Button type="button" variant="outline" onClick={reveal}>
                    看答案
                  </Button>
                ) : (
                  <Button type="button" onClick={advance}>
                    下一题
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={restart}>
                  重新开始
                </Button>
              </div>
              <PianoKeyboard
                entered={entered}
                held={held}
                wrongPitchClass={grade?.wrongPitchClass ?? null}
                onPress={(pitchClass) => {
                  setHeld((current) => [...current, pitchClass]);
                  answer(pitchClass);
                  window.setTimeout(() => {
                    setHeld((current) => current.filter((item) => item !== pitchClass));
                  }, 120);
                }}
              />
              <p className="text-xs text-muted-foreground">
                白键 1–7 对应 C D E F G A B，黑键是 Q W R T Y。答对后自动进入下一题，答错后按 Enter 继续。
              </p>
            </>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <SettingsPanel
            settings={settings}
            midi={midi}
            onChange={updateSettings}
            onConnectMidi={() => {
              void connectMidi();
            }}
          />
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-medium">错题记录</h2>
            {lifetime.recentMisses.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">还没有错题。记在这台浏览器里，刷新还在。</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {lifetime.recentMisses.slice(0, 5).map((miss, index) => (
                  <li key={`${miss.expectedLabel}-${index}`} className="border-b border-border/70 pb-2 last:border-0">
                    <p>
                      {miss.clefLabel} · 谱面 {miss.expectedLabel}
                    </p>
                    <p className="text-muted-foreground">你的回答：{miss.playedLabel}</p>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-4 text-sm font-medium">累计容易混淆</h3>
            {topMisses.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {lifetime.totalAttempts === 0
                  ? '练过的题会记在这台浏览器里。'
                  : `累计 ${lifetime.totalAttempts} 题，正确率 ${SessionScore.formatAccuracy(lifetime.totalCorrect / lifetime.totalAttempts)}。`}
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {topMisses.map(([name, count]) => (
                  <li key={name} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {name} × {count}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              累计 {lifetime.totalAttempts} 题 · 完成 {lifetime.sessionsCompleted} 轮 · 最佳连对 {lifetime.bestStreak}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/80 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function describeFeedback(
  phase: string,
  correct: boolean | null,
  reason: string | null,
  answer: string,
): { title: string; detail: string } | null {
  if (phase !== 'feedback' || correct === null) return null;
  if (correct) return { title: '正确', detail: answer };
  if (reason === 'timeout') return { title: '时间到了', detail: `正确答案是 ${answer}` };
  if (reason === 'reveal') return { title: '先记住这个音', detail: answer };
  return { title: '不正确', detail: `正确答案是 ${answer}` };
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
}
