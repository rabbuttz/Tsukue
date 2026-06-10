import { useLayoutEffect, useRef, useState } from 'react';
import type { PlacedWidget } from '../storage/deskLayout';
import { useObjectMove } from '../hooks/useObjectMove';
import { useCornerResize } from '../hooks/useCornerResize';
import { WidgetView } from './WidgetView';

interface Props {
  widget: PlacedWidget;
  now: number;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, scale: number) => void;
}

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

/**
 * 机に置かれた1つのウィジェットの「枠」。位置・ドラッグ移動・リサイズ・取り外しを受け持ち、
 * 中身（ポモドーロ／時計など）は kind で出し分ける。
 * リサイズは中身の自然サイズに対する等倍スケール（transform: scale）で行う。
 */
export function DeskWidget({ widget, now, onMove, onRemove, onResize }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // 中身の自然サイズ（スケール1のときのpx）。これに scale を掛けて枠サイズを決める。
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  // リサイズ中のプレビュー用スケール（確定までは保存しない）。
  const [liveScale, setLiveScale] = useState<number | null>(null);

  const savedScale = widget.scale ?? 1;
  const scale = liveScale ?? savedScale;

  useLayoutEffect(() => {
    const b = bodyRef.current;
    if (b) setNatural({ w: b.offsetWidth, h: b.offsetHeight });
  }, []);

  // 本体の上から直接ドラッグで移動できる（閾値方式）。操作ボタンやハンドルの上では掴まないので、
  // ポモドーロ等のボタンはクリックでそのまま反応する。
  const { drag, begin } = useObjectMove(
    { x: widget.x, y: widget.y },
    (x, y) => onMove(widget.id, x, y),
    '.widget__remove, .widget__resize, button, input, a, textarea',
  );

  const beginResize = useCornerResize((dx, _dy, done) => {
    if (!natural) return;
    // 横方向の伸びを基準に等倍スケールを算出（縦横比は維持）。
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (natural.w * savedScale + dx) / natural.w));
    if (done) {
      setLiveScale(null);
      onResize(widget.id, next);
    } else {
      setLiveScale(next);
    }
  });

  const x = drag?.x ?? widget.x;
  const y = drag?.y ?? widget.y;
  // 枠の実寸：自然サイズ × スケール。リサイズハンドルを見た目の右下に合わせるため明示する。
  const box = natural ? { width: natural.w * scale, height: natural.h * scale } : undefined;

  return (
    <div
      className={`widget${drag ? ' widget--dragging' : ''}${
        liveScale != null ? ' widget--resizing' : ''
      }`}
      style={{ left: x, top: y, ...box }}
      onPointerDown={begin}
    >
      <button
        className="widget__remove"
        onClick={() => onRemove(widget.id)}
        title="ウィジェットを外す"
        aria-label="ウィジェットを外す"
      >
        ×
      </button>
      <div
        className="widget__scaler"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <div className="widget__body" ref={bodyRef}>
          <WidgetView kind={widget.kind} now={now} />
        </div>
      </div>

      <span
        className="widget__resize"
        title="ドラッグで大きさを変える"
        aria-label="大きさを変える"
        onPointerDown={beginResize}
      />
    </div>
  );
}
