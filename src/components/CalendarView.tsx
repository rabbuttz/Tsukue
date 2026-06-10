import { useMemo, useState } from 'react';
import type { Status, Task } from '../types';
import { isPad } from '../state/useTasks';
import { toISODate } from '../lib/date';

interface Props {
  tasks: Task[];
  onClose: () => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const STATUS_LABEL: Record<Status, string> = {
  todo: 'To Do',
  inProgress: '作業中',
  done: '完了',
};

/** カレンダー表示。付箋を「左上に書いた日付」ごとにふわっと並べる。 */
export function CalendarView({ tasks, onClose }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    // 右上に駐機中の白紙パッドだけ除外。置いた付箋は空でも表示する。
    for (const t of tasks) {
      if (isPad(t)) continue;
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const start = new Date(year, month, 1 - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return {
        date: d,
        iso: toISODate(d),
        inMonth: d.getMonth() === month,
      };
    });
  }, [year, month]);

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const todayIso = toISODate(now);

  return (
    <div className="calview">
      <header className="calview__bar">
        <div className="calview__nav">
          <button className="btn btn-secondary calview__navbtn" onClick={prevMonth}>
            ‹
          </button>
          <h2 className="calview__title">
            {year}年 {month + 1}月
          </h2>
          <button className="btn btn-secondary calview__navbtn" onClick={nextMonth}>
            ›
          </button>
        </div>
        <div className="calview__legend">
          <span className="legend"><span className="mini__dot mini__dot--todo" />To Do</span>
          <span className="legend"><span className="mini__dot mini__dot--inProgress" />作業中</span>
          <span className="legend"><span className="mini__dot mini__dot--done" />完了</span>
        </div>
      </header>

      <div className="calview__weekdays">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`calview__wd${i === 0 ? ' calview__wd--sun' : ''}${i === 6 ? ' calview__wd--sat' : ''}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="calview__grid">
        {cells.map((cell) => {
          const items = byDate.get(cell.iso) ?? [];
          return (
            <div
              key={cell.iso}
              className={`calcell${cell.inMonth ? '' : ' calcell--dim'}${cell.iso === todayIso ? ' calcell--today' : ''}`}
            >
              <div className="calcell__num">{cell.date.getDate()}</div>
              <div className="calcell__notes">
                {items.map((t, idx) => (
                  <div
                    key={t.id}
                    data-task-id={t.id}
                    className={`mini mini--${t.color} mini--${t.status}`}
                    style={{ animationDelay: `${Math.min(idx, 6) * 40}ms` }}
                    title={`${STATUS_LABEL[t.status]}：${t.content || '(無題)'}`}
                  >
                    <span className={`mini__dot mini__dot--${t.status}`} />
                    <span className="mini__text">{t.content || '(無題)'}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button className="back-to-desk" onClick={onClose} title="机に戻る">
        <span className="back-to-desk__label">▴ 机に戻る</span>
        <span className="back-to-desk__grip" aria-hidden />
      </button>
    </div>
  );
}
