import { useCallback, useRef, useState } from 'react';
import type { StickyColor, View } from './types';
import { useTasks, isPad } from './state/useTasks';
import { useNow } from './hooks/useNow';
import { WallCalendar } from './components/WallCalendar';
import { DeskView } from './components/DeskView';
import { CalendarView } from './components/CalendarView';

const FLIP_MS = 560;

interface Fly {
  id: string;
  color: StickyColor;
  content: string;
  src: DOMRect;
  dst: DOMRect;
}

/** コンテナ内の付箋要素の画面矩形を id ごとに集める。 */
function rectsOf(container: HTMLElement | null): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>();
  container?.querySelectorAll<HTMLElement>('[data-task-id]').forEach((el) => {
    const id = el.getAttribute('data-task-id');
    if (id) m.set(id, el.getBoundingClientRect());
  });
  return m;
}

export default function App() {
  const store = useTasks();
  const now = useNow(1000);
  const [view, setView] = useState<View>('desk');
  const [transitioning, setTransitioning] = useState(false);
  const [clones, setClones] = useState<Fly[]>([]);
  const [phase, setPhase] = useState<'start' | 'end'>('start');

  const deskRef = useRef<HTMLDivElement>(null);
  const calRef = useRef<HTMLDivElement>(null);

  const today = new Date(now);
  const monthLabel = `${today.getFullYear()}年 ${today.getMonth() + 1}月`;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const clockLabel = `${pad2(today.getHours())}:${pad2(today.getMinutes())}:${pad2(today.getSeconds())}`;
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const dateLabel = `${today.getMonth() + 1}月${today.getDate()}日（${weekdays[today.getDay()]}）`;

  const navigate = useCallback(
    (to: View) => {
      if (transitioning || to === view) return;

      // 両ビューとも常時マウント済みなので、双方の付箋位置を計測できる。
      const deskRects = rectsOf(deskRef.current);
      const calRects = rectsOf(calRef.current);
      const src = to === 'calendar' ? deskRects : calRects;
      const dst = to === 'calendar' ? calRects : deskRects;
      const trashRect = deskRef.current
        ?.querySelector<HTMLElement>('[data-trash]')
        ?.getBoundingClientRect();

      const flies: Fly[] = [];
      for (const t of store.tasks) {
        if (isPad(t)) continue;
        const dstRect = dst.get(t.id);
        if (!dstRect) continue; // 行き先に表示が無い（別月など）なら飛ばさない
        // 机側に札が無い完了タスクなどはゴミ箱から出入りさせる。
        const srcRect = src.get(t.id) ?? trashRect;
        if (!srcRect) continue;
        flies.push({ id: t.id, color: t.color, content: t.content, src: srcRect, dst: dstRect });
      }

      if (flies.length === 0) {
        setView(to);
        return;
      }

      setClones(flies);
      setPhase('start');
      setTransitioning(true);
      setView(to);
      // start を描画してから end へ（CSS トランジション発火）。
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('end')));
      window.setTimeout(() => {
        setTransitioning(false);
        setClones([]);
      }, FLIP_MS + 40);
    },
    [transitioning, view, store.tasks],
  );

  const deskShown = view === 'desk' && !transitioning;
  const calShown = view === 'calendar' && !transitioning;

  return (
    <div className="app">
      {view === 'desk' && !transitioning && (
        <WallCalendar
          monthLabel={monthLabel}
          clockLabel={clockLabel}
          dateLabel={dateLabel}
          onClick={() => navigate('calendar')}
        />
      )}

      <div className="stage">
        <div ref={deskRef} className={`view ${deskShown ? 'view--show' : 'view--hide'}`}>
          <DeskView store={store} now={now} />
        </div>
        <div ref={calRef} className={`view ${calShown ? 'view--show' : 'view--hide'}`}>
          <CalendarView tasks={store.tasks} onClose={() => navigate('desk')} />
        </div>
      </div>

      {clones.map((c) => {
        const r = phase === 'start' ? c.src : c.dst;
        return (
          <div
            key={c.id}
            className={`fly fly--${c.color}`}
            style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
          >
            <span className="fly__text">{c.content}</span>
          </div>
        );
      })}
    </div>
  );
}
