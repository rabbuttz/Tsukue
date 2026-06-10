import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toISODate } from '../lib/date';

interface Props {
  value: string;
  /** 開いた瞬間の日付チップの矩形（画面座標）。ポップオーバーの位置決めに使う。 */
  anchor: DOMRect;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const POPUP_W = 256;
const POPUP_H = 312;

/** 付箋の日付チップから開く、おしゃれなカレンダー選択ポップオーバー。 */
export function DatePicker({ value, anchor, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const init = value ? new Date(`${value}T00:00:00`) : new Date();
  const [year, setYear] = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, iso: toISODate(d), inMonth: d.getMonth() === month };
    });
  }, [year, month]);

  const prev = () => {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const next = () => {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const todayIso = toISODate(new Date());

  // 画面内に収める。チップの下に出し、はみ出すなら上に出す。
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - POPUP_W - 8));
  const below = anchor.bottom + 8;
  const top = below + POPUP_H > window.innerHeight ? Math.max(8, anchor.top - POPUP_H - 8) : below;

  return createPortal(
    <div ref={ref} className="dpick" style={{ top, left, width: POPUP_W }}>
      <header className="dpick__head">
        <button className="dpick__nav" onClick={prev} title="前の月">
          ‹
        </button>
        <span className="dpick__title">
          {year}年 {month + 1}月
        </span>
        <button className="dpick__nav" onClick={next} title="次の月">
          ›
        </button>
      </header>

      <div className="dpick__weekdays">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={`dpick__wd${i === 0 ? ' dpick__wd--sun' : ''}${i === 6 ? ' dpick__wd--sat' : ''}`}
          >
            {w}
          </span>
        ))}
      </div>

      <div className="dpick__grid">
        {cells.map((c) => {
          const wd = c.date.getDay();
          const classes = [
            'dpick__day',
            c.inMonth ? '' : 'dpick__day--dim',
            c.iso === value ? 'dpick__day--selected' : '',
            c.iso === todayIso ? 'dpick__day--today' : '',
            wd === 0 ? 'dpick__day--sun' : '',
            wd === 6 ? 'dpick__day--sat' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={c.iso}
              className={classes}
              onClick={() => {
                onSelect(c.iso);
                onClose();
              }}
            >
              {c.date.getDate()}
            </button>
          );
        })}
      </div>

      <footer className="dpick__foot">
        <button
          className="dpick__today"
          onClick={() => {
            onSelect(todayIso);
            onClose();
          }}
        >
          今日
        </button>
      </footer>
    </div>,
    document.body,
  );
}
