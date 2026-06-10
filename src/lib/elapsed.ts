import type { Task } from '../types';

/** いま作業中で計測が進行しているか。 */
export function isRunning(t: Task): boolean {
  return t.status === 'inProgress' && t.inProgressAt != null;
}

/**
 * 「作業中だった時間」の合計（ミリ秒）。
 * = これまでの累積 + （いま計測中なら現在セッション分）。
 * ToDo / 完了に置いている間は累積のみで増えない。
 */
export function elapsedMs(t: Task, now: number): number {
  const base = t.accumulatedMs ?? 0;
  const running = isRunning(t) ? Math.max(0, now - (t.inProgressAt as number)) : 0;
  return base + running;
}
