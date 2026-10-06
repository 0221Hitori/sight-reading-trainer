import { useEffect, useId, useRef, useState } from 'react';
import type { Exercise, Grade } from '@/music/types';
import { ExerciseView } from '@/music/exercise';
import { StaffRenderer } from '@/notation/staff-renderer';
import type { SlotMark } from '@/session/practice-round';

interface StaffViewProps {
  exercise: Exercise;
  cursor: number;
  entered: readonly number[];
  marks: readonly (SlotMark | null)[];
  grade: Grade | null;
}

/**
 * 谱面。判分之前的 aria-label 只描述谱号和调号，不念出音名。
 * 宽度不变时不重画，避免计时器每次刷新都重建 SVG。
 */
export function StaffView({ exercise, cursor, entered, marks, grade }: StaffViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    let paintedWidth = -1;
    const paint = (force: boolean) => {
      if (cancelled || !hostRef.current) return;
      const width = hostRef.current.clientWidth;
      if (!force && width === paintedWidth) return;
      paintedWidth = width;
      try {
        StaffRenderer.draw(hostRef.current, exercise, { cursor, entered, marks, width });
        setStatus('ready');
      } catch (error) {
        console.error(error);
        setStatus('error');
      }
    };

    void StaffRenderer.ensureFonts()
      .then(() => paint(true))
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setStatus('error');
      });

    const observer = new ResizeObserver(() => paint(false));
    observer.observe(host);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [exercise, cursor, entered, marks, grade]);

  return (
    <div
      className="staff-host relative"
      data-testid="staff"
      role="img"
      aria-label={
        grade
          ? `${ExerciseView.meta(exercise)}。第 ${cursor + 1} 个音${grade.correct ? '回答正确' : '回答不正确'}，${ExerciseView.answerLabel(ExerciseView.slot(exercise, cursor).notes)}`
          : `${ExerciseView.meta(exercise)}。从左到右，当前是第 ${cursor + 1} 个音，共 ${exercise.slots.length} 个。请按键盘或点击琴键作答。`
      }
    >
      <div ref={hostRef} id={`staff-${reactId.replace(/:/g, '')}`} className="min-h-[210px] w-full" />
      {status === 'loading' && (
        <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">正在刻写谱面…</p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          谱面没有画出来。刷新页面后再试一次。
        </p>
      )}
    </div>
  );
}
