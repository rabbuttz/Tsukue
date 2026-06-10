import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Task } from '../types';
import { formatElapsed, formatJpDate } from '../lib/date';
import { elapsedMs, isRunning } from '../lib/elapsed';
import { DatePicker } from './DatePicker';

interface Props {
  task: Task;
  now: number;
  dragging: boolean;
  /** 配置変更モード。本文・日付の操作をロックし、付箋全体を掴んで移動できるようにする。 */
  arrange?: boolean;
  onDragStart: (id: string, e: React.PointerEvent, el: HTMLElement) => void;
  onContentChange: (id: string, content: string) => void;
  onDateChange: (id: string, date: string) => void;
  style?: CSSProperties;
}

/** id から決定的に小さな傾きを出す（再描画でぶれない付箋らしさ）。 */
function tiltOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 50) / 10) - 2.5; // -2.5° 〜 +2.5°
}

export function StickyNote({
  task,
  now,
  dragging,
  arrange = false,
  onDragStart,
  onContentChange,
  onDateChange,
  style,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // 入力系の上では掴まない（編集とドラッグの区別）。
    if ((e.target as HTMLElement).closest('textarea, input, button')) return;
    if (rootRef.current) onDragStart(task.id, e, rootRef.current);
  };

  const tilt = dragging ? 0 : tiltOf(task.id);

  return (
    <div
      ref={rootRef}
      data-task-id={task.id}
      className={`sticky sticky--${task.color} no-select${dragging ? ' sticky--ghost' : ''}${arrange ? ' sticky--arrange' : ''}`}
      style={{ ...style, ['--tilt' as string]: `${tilt}deg` }}
      onPointerDown={handlePointerDown}
    >
      <div className="sticky__header">
        <button
          className="sticky__date"
          title="日付を選ぶ"
          onClick={(e) => setPickerAnchor(e.currentTarget.getBoundingClientRect())}
        >
          {formatJpDate(task.date)}
        </button>
      </div>

      {pickerAnchor && (
        <DatePicker
          value={task.date}
          anchor={pickerAnchor}
          onSelect={(iso) => onDateChange(task.id, iso)}
          onClose={() => setPickerAnchor(null)}
        />
      )}

      <textarea
        className="sticky__content"
        placeholder="やることを書く…"
        value={task.content}
        onChange={(e) => onContentChange(task.id, e.target.value)}
      />

      {(() => {
        const ms = elapsedMs(task, now);
        const running = isRunning(task);
        if (ms <= 0 && !running) return null;
        return (
          <div
            className={`sticky__elapsed${running ? '' : ' sticky__elapsed--paused'}`}
            title={running ? '作業中（計測中）' : '一時停止中（経過時間を保持）'}
          >
            {running ? '⏱' : '⏸'} {formatElapsed(ms)}
          </div>
        );
      })()}
    </div>
  );
}
