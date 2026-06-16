import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { StickyColor, StickyFontSize, Task } from '../types';
import { StickyNote } from './StickyNote';

const GAP = 12; // 展開時の付箋の間隔
const TOP_PAD = 6; // 上端の余白
const BOT_PAD = 6; // 下端の余白
const PEEK = 9; // 端で重なるときに覗かせる量
const MAX_PEEK = 3; // 端で覗かせる枚数（これを超えるとほぼ重なる）

interface Props {
  tasks: Task[];
  now: number;
  dragId: string | null;
  hovered: boolean;
  onDragStart: (id: string, e: React.PointerEvent, el: HTMLElement) => void;
  onContentChange: (id: string, content: string) => void;
  onDateChange: (id: string, date: string) => void;
  onColorChange: (id: string, color: StickyColor) => void;
  onFontSizeChange: (id: string, size: StickyFontSize) => void;
  onAdd: () => void;
}

/** トレイ（To Do）。付箋を縦に積み、はみ出る分は上下の端で重ねる受け皿。 */
export const Tray = forwardRef<HTMLDivElement, Props>(function Tray(
  {
    tasks,
    now,
    dragId,
    hovered,
    onDragStart,
    onContentChange,
    onDateChange,
    onColorChange,
    onFontSizeChange,
    onAdd,
  },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  // スクロール位置に応じて各付箋の縦位置を決める。
  // 表示域に収まる付箋は通常の間隔で並べ、上にはみ出る分は上端に、
  // 下にはみ出る分は下端に、少しずつ覗かせながら重ねる。
  const relayout = useCallback(() => {
    const scroller = scrollRef.current;
    const stack = stackRef.current;
    if (!scroller || !stack) return;
    const slots = Array.from(stack.children) as HTMLElement[];
    const n = slots.length;
    if (n === 0) {
      stack.style.height = '0px';
      return;
    }

    // 各付箋の自然な位置（上から順に積んだときの top）。
    const heights = slots.map((s) => s.offsetHeight);
    const natural: number[] = [];
    let acc = TOP_PAD;
    for (let i = 0; i < n; i++) {
      natural[i] = acc;
      acc += heights[i] + GAP;
    }
    const contentH = acc - GAP + BOT_PAD;
    stack.style.height = `${contentH}px`;

    const scrollTop = scroller.scrollTop;
    const H = scroller.clientHeight;

    for (let i = 0; i < n; i++) {
      // 上端で取りうる最小 top（これより上には行けない＝上で重なる）。
      const topMin = scrollTop + TOP_PAD + Math.min(i, MAX_PEEK) * PEEK;
      // 下端で取りうる最大 top（これより下には行けない＝下で重なる）。
      const botMax = scrollTop + H - heights[i] - BOT_PAD - Math.min(n - 1 - i, MAX_PEEK) * PEEK;
      // 領域が狭くて topMin > botMax になるときは上端寄せを優先する。
      const eff = Math.min(Math.max(natural[i], topMin), Math.max(topMin, botMax));
      const pinnedBottom = natural[i] > botMax && botMax >= topMin;
      const slot = slots[i];
      slot.style.transform = `translateY(${eff}px)`;
      // 上の山は後の付箋を前面に、下の山は手前（次に出る付箋）を前面にする。
      slot.style.zIndex = String(pinnedBottom ? n - i : i);
    }
  }, []);

  // スクロール・リサイズは rAF で間引く。
  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      relayout();
    });
  }, [relayout]);

  useLayoutEffect(() => {
    relayout();
  }, [relayout, tasks]);

  useEffect(() => {
    const scroller = scrollRef.current;
    const stack = stackRef.current;
    if (!scroller || !stack) return;
    const ro = new ResizeObserver(schedule);
    ro.observe(scroller);
    for (const slot of Array.from(stack.children)) ro.observe(slot as Element);
    window.addEventListener('resize', schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [schedule, tasks]);

  return (
    <section ref={ref} className={`tray${hovered ? ' zone--hover' : ''}`}>
      <header className="tray__label">
        <span className="tray__title">To Do</span>
        <span className="tray__count">{tasks.length}</span>
      </header>
      <button type="button" className="tray__add" onClick={onAdd} title="新しい付箋を追加">
        ＋ 新しい付箋
      </button>
      <div className="tray__notes" ref={scrollRef} onScroll={schedule}>
        {tasks.length === 0 && <p className="tray__empty">付箋を追加してここに置きます</p>}
        <div className="tray__stack" ref={stackRef}>
          {tasks.map((t) => (
            <div className="tray__slot" key={t.id}>
              <StickyNote
                task={t}
                now={now}
                dragging={dragId === t.id}
                onDragStart={onDragStart}
                onContentChange={onContentChange}
                onDateChange={onDateChange}
                onColorChange={onColorChange}
                onFontSizeChange={onFontSizeChange}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
