import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WIDGET_CATALOG } from '../storage/deskLayout';
import type { WidgetKind } from '../storage/deskLayout';
import { WidgetView } from './WidgetView';

interface Props {
  /** 開いた瞬間のボタン矩形（画面座標）。ポップオーバーの位置決めに使う。 */
  anchor: DOMRect;
  /** ライブ更新用の現在時刻（プレビューの時計を動かす）。 */
  now: number;
  /** kind ごとの現在の設置数（バッジ表示用）。 */
  counts: Record<WidgetKind, number>;
  /** プレビューを掴んだ瞬間（ここから机へのドラッグ＆ドロップが始まる）。 */
  onPickStart: (kind: WidgetKind, e: React.PointerEvent) => void;
  onClose: () => void;
}

const POPUP_W = 324;
/** プレビュー表示枠（この中に実ウィジェットを縮小して収める）。 */
const STAGE_W = 128;
const STAGE_H = 116;

/** 実ウィジェットを縮小プレビューする1枚。掴んで机へドラッグすると追加できる。 */
function PreviewTile({
  kind,
  now,
  label,
  count,
  onPickStart,
}: {
  kind: WidgetKind;
  now: number;
  label: string;
  count: number;
  onPickStart: (kind: WidgetKind, e: React.PointerEvent) => void;
}) {
  const natRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // 実ウィジェットの自然サイズを測り、プレビュー枠に収まる倍率を出す。
  useLayoutEffect(() => {
    const el = natRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w && h) setScale(Math.min(STAGE_W / w, STAGE_H / h));
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      className="wpick__tile"
      title={`${label}：机へドラッグして追加`}
      onPointerDown={(e) => onPickStart(kind, e)}
    >
      <span className="wpick__stage">
        <span className="wpick__scale" style={{ transform: `scale(${scale})` }}>
          <span ref={natRef} className="wpick__nat">
            <WidgetView kind={kind} now={now} />
          </span>
        </span>
      </span>
      <span className="wpick__name">
        {label}
        {count > 0 && <span className="wpick__count">{count}</span>}
      </span>
    </div>
  );
}

/** 「＋ ウィジェット」から開く、実物プレビューをドラッグ＆ドロップで机に置くポップオーバー。 */
export function WidgetPicker({ anchor, now, counts, onPickStart, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // 開閉ボタン自身のクリックはトグル側に任せる（ここで閉じると再オープンと競合する）。
      if (ref.current && !ref.current.contains(t) && !t.closest('.widget-add')) onClose();
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

  // ボタンの下に出し、右端がはみ出さないよう収める。
  const left = Math.max(8, Math.min(anchor.right - POPUP_W, window.innerWidth - POPUP_W - 8));
  const top = anchor.bottom + 8;

  return createPortal(
    <div ref={ref} className="wpick" style={{ top, left, width: POPUP_W }}>
      <div className="wpick__title">ウィジェットを机へドラッグ</div>
      <div className="wpick__grid">
        {WIDGET_CATALOG.map((item) => (
          <PreviewTile
            key={item.kind}
            kind={item.kind}
            now={now}
            label={item.label}
            count={counts[item.kind]}
            onPickStart={onPickStart}
          />
        ))}
      </div>
      <p className="wpick__hint">プレビューを掴んで机の上にドロップすると置けます</p>
    </div>,
    document.body,
  );
}
