import { forwardRef } from 'react';
import type { StickyColor, StickyFontSize, Task } from '../types';
import type { PlacedItem, PlacedWidget } from '../storage/deskLayout';
import { isPad } from '../state/useTasks';
import { StickyNote } from './StickyNote';
import { DeskWidget } from './DeskWidget';
import { DeskItem } from './DeskItem';

interface Props {
  tasks: Task[];
  /** タスク連動ウィジェット（集中時間メーター・盆栽）用の全タスク（完了分も含む）。 */
  allTasks: Task[];
  now: number;
  dragId: string | null;
  hovered: boolean;
  /** 机に置かれたウィジェット（ポモドーロ／時計など）。 */
  widgets: PlacedWidget[];
  onWidgetMove: (id: string, x: number, y: number) => void;
  onWidgetRemove: (id: string) => void;
  onWidgetResize: (id: string, scale: number) => void;
  /** 机に貼られたコンテンツ（テキスト／画像／動画／URL）。 */
  items: PlacedItem[];
  onItemMove: (id: string, x: number, y: number) => void;
  onItemRemove: (id: string) => void;
  onItemResize: (id: string, w: number, h: number) => void;
  onItemChange: (id: string, patch: Partial<PlacedItem>) => void;
  onDragStart: (id: string, e: React.PointerEvent, el: HTMLElement) => void;
  onContentChange: (id: string, content: string) => void;
  onDateChange: (id: string, date: string) => void;
  onColorChange: (id: string, color: StickyColor) => void;
  onFontSizeChange: (id: string, size: StickyFontSize) => void;
}

/** 机の上（In Progress / 自由配置）。右上には白紙パッドが常駐する。 */
export const DeskSurface = forwardRef<HTMLDivElement, Props>(function DeskSurface(
  {
    tasks,
    allTasks,
    now,
    dragId,
    hovered,
    widgets,
    onWidgetMove,
    onWidgetRemove,
    onWidgetResize,
    items,
    onItemMove,
    onItemRemove,
    onItemResize,
    onItemChange,
    onDragStart,
    onContentChange,
    onDateChange,
    onColorChange,
    onFontSizeChange,
  },
  ref,
) {
  const hasRealNote = tasks.some((t) => !isPad(t));

  return (
    <div ref={ref} className={`desk${hovered ? ' zone--hover' : ''}`}>
      {items.map((it) => (
        <DeskItem
          key={it.id}
          item={it}
          onMove={onItemMove}
          onRemove={onItemRemove}
          onResize={onItemResize}
          onChange={onItemChange}
        />
      ))}

      {widgets.map((w) => (
        <DeskWidget
          key={w.id}
          widget={w}
          now={now}
          tasks={allTasks}
          onMove={onWidgetMove}
          onRemove={onWidgetRemove}
          onResize={onWidgetResize}
        />
      ))}

      {!hasRealNote && (
        <p className="desk__hint">
          右上の付箋に書いて、机のどこかへ置いてみましょう
          <br />
          （何も書かずに掴んで動かしてもOK）
        </p>
      )}

      {tasks.map((t) =>
        isPad(t) ? (
          <div key={t.id} className="pad-anchor">
            <span className="pad-sheet pad-sheet--1" aria-hidden />
            <span className="pad-sheet pad-sheet--2" aria-hidden />
            <StickyNote
              task={t}
              now={now}
              dragging={dragId === t.id}
              onDragStart={onDragStart}
              onContentChange={onContentChange}
              onDateChange={onDateChange}
              onColorChange={onColorChange}
              onFontSizeChange={onFontSizeChange}
              style={{ position: 'relative' }}
            />
          </div>
        ) : (
          <StickyNote
            key={t.id}
            task={t}
            now={now}
            dragging={dragId === t.id}
            onDragStart={onDragStart}
            onContentChange={onContentChange}
            onDateChange={onDateChange}
            onColorChange={onColorChange}
            onFontSizeChange={onFontSizeChange}
            style={{ position: 'absolute', left: t.position.x, top: t.position.y }}
          />
        ),
      )}
    </div>
  );
});
