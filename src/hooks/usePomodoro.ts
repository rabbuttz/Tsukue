import { useCallback, useEffect, useRef, useState } from 'react';
import { playChime } from '../lib/sound';
import { requestNotifyPermission, showNotification } from '../lib/notify';

export type PomoPhase = 'focus' | 'break';

/** 集中・休憩の長さ（ミリ秒）。プロトタイプなので固定の 25 分 / 5 分。 */
export const POMO_FOCUS_MS = 25 * 60 * 1000;
export const POMO_BREAK_MS = 5 * 60 * 1000;

export interface Pomodoro {
  phase: PomoPhase;
  running: boolean;
  /** 現フェーズの残りミリ秒。 */
  remainingMs: number;
  /** 現フェーズの総ミリ秒（進捗リングの分母）。 */
  totalMs: number;
  /** 完了した集中セッション数（🍅 の数）。 */
  completed: number;
  /** 直近にフェーズが切り替わったか（チャイム演出のトリガに使う）。 */
  toggle: () => void;
  reset: () => void;
  skip: () => void;
}

const phaseTotal = (p: PomoPhase) => (p === 'focus' ? POMO_FOCUS_MS : POMO_BREAK_MS);

/**
 * ポモドーロタイマーの状態。タスクとは独立した一時状態で永続化しない。
 * 走行中は終了時刻を基準に残り時間を算出し、ドリフトを抑える。
 */
export function usePomodoro(): Pomodoro {
  const [phase, setPhase] = useState<PomoPhase>('focus');
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(POMO_FOCUS_MS);
  const [completed, setCompleted] = useState(0);
  const remainingRef = useRef(remainingMs);
  remainingRef.current = remainingMs;

  useEffect(() => {
    if (!running) return;
    const endAt = Date.now() + remainingRef.current;
    const id = window.setInterval(() => {
      const left = endAt - Date.now();
      if (left > 0) {
        setRemainingMs(left);
        return;
      }
      // フェーズ完了：集中→休憩 / 休憩→集中 に切り替え、いったん停止して待つ。
      setRunning(false);
      if (phase === 'focus') setCompleted((c) => c + 1);
      const next: PomoPhase = phase === 'focus' ? 'break' : 'focus';
      setPhase(next);
      setRemainingMs(phaseTotal(next));
      playChime([880, 1320]);
      showNotification(
        phase === 'focus' ? '🍅 集中タイム終了' : '🍵 休憩おわり',
        phase === 'focus' ? 'おつかれさま。5分ひとやすみしましょう。' : '集中タイムに戻りましょう。',
        'tsukue-pomodoro',
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [running, phase]);

  const toggle = useCallback(() => {
    // スタート押下（ユーザー操作）のタイミングで通知許可を求めておく。
    requestNotifyPermission();
    setRunning((r) => !r);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setRemainingMs(phaseTotal(phase));
  }, [phase]);

  const skip = useCallback(() => {
    setRunning(false);
    setPhase((p) => {
      const next: PomoPhase = p === 'focus' ? 'break' : 'focus';
      setRemainingMs(phaseTotal(next));
      return next;
    });
  }, []);

  return {
    phase,
    running,
    remainingMs,
    totalMs: phaseTotal(phase),
    completed,
    toggle,
    reset,
    skip,
  };
}
