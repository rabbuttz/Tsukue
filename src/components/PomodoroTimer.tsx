import { usePomodoro } from '../hooks/usePomodoro';

/** ミリ秒を MM:SS に整形。 */
function mmss(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** オシャレでかわいいポモドーロタイマー。配置や移動は DeskWidget 側が受け持つ。 */
export function PomodoroTimer() {
  const pomo = usePomodoro();
  const isFocus = pomo.phase === 'focus';
  // 残り時間の割合でリングを満たす（残りが多いほど満タン）。
  const ratio = pomo.totalMs > 0 ? pomo.remainingMs / pomo.totalMs : 0;
  const dash = RING_C * (1 - ratio);

  return (
    <div className={`pomo pomo--${pomo.phase}${pomo.running ? ' pomo--running' : ''}`}>
      <div className="pomo__phase">
        <span className="pomo__face">{isFocus ? '🍅' : '🍵'}</span>
        {isFocus ? '集中タイム' : 'ひとやすみ'}
      </div>

      <div className="pomo__dial">
        <svg className="pomo__ring" viewBox="0 0 120 120" aria-hidden>
          <circle className="pomo__track" cx="60" cy="60" r={RING_R} />
          <circle
            className="pomo__progress"
            cx="60"
            cy="60"
            r={RING_R}
            strokeDasharray={RING_C}
            strokeDashoffset={dash}
          />
        </svg>
        <div className="pomo__time">{mmss(pomo.remainingMs)}</div>
      </div>

      <div className="pomo__controls">
        <button
          className="pomo__btn pomo__btn--ghost"
          onClick={pomo.reset}
          title="リセット"
          aria-label="リセット"
        >
          ↺
        </button>
        <button
          className="pomo__btn pomo__btn--main"
          onClick={pomo.toggle}
          title={pomo.running ? '一時停止' : 'スタート'}
          aria-label={pomo.running ? '一時停止' : 'スタート'}
        >
          {pomo.running ? '❚❚' : '▶'}
        </button>
        <button
          className="pomo__btn pomo__btn--ghost"
          onClick={pomo.skip}
          title={isFocus ? '休憩へ' : '集中へ'}
          aria-label="スキップ"
        >
          ⏭
        </button>
      </div>

      <div className="pomo__tomatoes" title={`今日の集中：${pomo.completed} 回`}>
        {pomo.completed === 0 ? (
          <span className="pomo__tomatoes-empty">まだ集中なし</span>
        ) : (
          Array.from({ length: Math.min(pomo.completed, 8) }).map((_, i) => (
            <span key={i} className="pomo__tomato">
              🍅
            </span>
          ))
        )}
        {pomo.completed > 8 && <span className="pomo__tomatoes-more">+{pomo.completed - 8}</span>}
      </div>
    </div>
  );
}
