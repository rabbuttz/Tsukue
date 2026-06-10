import type { Task } from '../types';
import { elapsedMs, isRunning } from '../lib/elapsed';
import { isPad } from '../state/useTasks';

/** ミリ秒をコンパクトな日本語表記にする（例: 1時間23分 / 23分45秒 / 45秒 / 0分）。 */
function formatJa(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  if (s > 0) return `${s}秒`;
  return '0分';
}

/**
 * 集中時間メーター。
 * 机の上（status:'inProgress'、白紙パッドを除く）にある付箋の作業時間を合計して表示する。
 * ※ 1日単位の記録ではなく、累積バンク（accumulatedMs）＋進行中セッションの合計。
 */
export function FocusMeter({ tasks, now }: { tasks: Task[]; now: number }) {
  const deskTasks = tasks.filter((t) => t.status === 'inProgress' && !isPad(t));
  const totalMs = deskTasks.reduce((sum, t) => sum + elapsedMs(t, now), 0);
  const runningCount = deskTasks.filter(isRunning).length;
  const running = runningCount > 0;

  return (
    <div className={`fmeter${running ? ' fmeter--running' : ''}`}>
      <div className="fmeter__title">
        <span className="fmeter__icon">⏱️</span>
        集中時間
      </div>
      <div className="fmeter__total">{formatJa(totalMs)}</div>
      <div className="fmeter__status">
        {running ? (
          <>
            <span className="fmeter__dot" aria-hidden="true" />
            {runningCount}件 計測中
          </>
        ) : (
          '机にタスクを置くと計測開始'
        )}
      </div>
    </div>
  );
}
