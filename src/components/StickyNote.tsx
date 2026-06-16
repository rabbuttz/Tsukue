import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { StickyColor, StickyFontSize, Task } from '../types';
import { STICKY_COLORS, STICKY_FONT_PX, STICKY_FONT_SIZES } from '../types';
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
  onColorChange?: (id: string, color: StickyColor) => void;
  onFontSizeChange?: (id: string, size: StickyFontSize) => void;
  style?: CSSProperties;
}

/** id から決定的に小さな傾きを出す（再描画でぶれない付箋らしさ）。 */
function tiltOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 50) / 10) - 2.5; // -2.5° 〜 +2.5°
}

const COLOR_LABELS: Record<StickyColor, string> = {
  yellow: '黄色',
  coral: 'コーラル',
  teal: 'ティール',
  rose: 'ローズ',
  orange: 'オレンジ',
};

const SIZE_LABELS: Record<StickyFontSize, string> = { s: '小', m: '中', l: '大' };

const TOOLBAR_W = 232; // クランプ計算用の概算幅

interface ToolbarAnchor {
  x: number; // 付箋の中央X（画面座標）
  top: number;
  bottom: number;
}

export function StickyNote({
  task,
  now,
  dragging,
  arrange = false,
  onDragStart,
  onContentChange,
  onDateChange,
  onColorChange,
  onFontSizeChange,
  style,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [toolbar, setToolbar] = useState<ToolbarAnchor | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  // ドラッグが始まったらツールバーは閉じる。
  useEffect(() => {
    if (dragging) setToolbar(null);
  }, [dragging]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const canStyle = !arrange && (onColorChange != null || onFontSizeChange != null);

  const showToolbar = (e: React.PointerEvent) => {
    if (!canStyle || dragging) return;
    if (e.buttons !== 0) return; // 別の付箋をドラッグ中に通過しただけなら出さない
    window.clearTimeout(hideTimer.current);
    const r = rootRef.current?.getBoundingClientRect();
    if (r) setToolbar({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
  };

  const scheduleHideToolbar = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setToolbar(null), 140);
  };

  const cancelHideToolbar = () => window.clearTimeout(hideTimer.current);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // 入力系の上では掴まない（編集とドラッグの区別）。
    if ((e.target as HTMLElement).closest('textarea, input, button')) return;
    setToolbar(null);
    if (rootRef.current) onDragStart(task.id, e, rootRef.current);
  };

  const tilt = dragging ? 0 : tiltOf(task.id);
  const fontSize = task.fontSize ?? 'm';

  // 画面上端に近いときは付箋の下側に出す。
  const toolbarBelow = toolbar != null && toolbar.top < 64;
  const toolbarLeft =
    toolbar == null
      ? 0
      : Math.max(8 + TOOLBAR_W / 2, Math.min(toolbar.x, window.innerWidth - 8 - TOOLBAR_W / 2));

  return (
    <div
      ref={rootRef}
      data-task-id={task.id}
      className={`sticky sticky--${task.color} no-select${dragging ? ' sticky--ghost' : ''}${arrange ? ' sticky--arrange' : ''}`}
      style={{
        ...style,
        ['--tilt' as string]: `${tilt}deg`,
        ['--note-font-size' as string]: `${STICKY_FONT_PX[fontSize]}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerEnter={showToolbar}
      onPointerLeave={scheduleHideToolbar}
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

      {toolbar &&
        createPortal(
          <div
            className="ntb"
            style={{
              left: toolbarLeft,
              top: toolbarBelow ? toolbar.bottom + 8 : toolbar.top - 8,
              transform: toolbarBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
            }}
            onPointerEnter={cancelHideToolbar}
            onPointerLeave={scheduleHideToolbar}
          >
            {onColorChange && (
              <div className="ntb__group">
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`ntb__swatch ntb__swatch--${c}${c === task.color ? ' ntb__swatch--active' : ''}`}
                    title={COLOR_LABELS[c]}
                    aria-label={`色: ${COLOR_LABELS[c]}`}
                    onClick={() => onColorChange(task.id, c)}
                  />
                ))}
              </div>
            )}
            {onColorChange && onFontSizeChange && <span className="ntb__sep" aria-hidden />}
            {onFontSizeChange && (
              <div className="ntb__group">
                {STICKY_FONT_SIZES.map((s) => (
                  <button
                    key={s}
                    className={`ntb__size ntb__size--${s}${s === fontSize ? ' ntb__size--active' : ''}`}
                    title={`文字サイズ: ${SIZE_LABELS[s]}`}
                    aria-label={`文字サイズ: ${SIZE_LABELS[s]}`}
                    onClick={() => onFontSizeChange(task.id, s)}
                  >
                    あ
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
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
