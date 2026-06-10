import { useCallback, useRef, useState } from 'react';
import type { Position } from '../types';

export type ZoneName = 'tray' | 'desk' | 'trash';

export interface Zone {
  name: ZoneName;
  ref: React.RefObject<HTMLElement | null>;
}

export interface DragVisual {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Args {
  zones: Zone[];
  /** ドロップ確定時に呼ばれる。desk の場合のみ deskPos に机面相対座標が入る。 */
  onDrop: (id: string, zone: ZoneName, deskPos: Position | null) => void;
  /** ドラッグ中、ポインタが乗っているゾーン（強調表示用）。 */
  onHover?: (zone: ZoneName | null) => void;
}

/**
 * ポインタイベントによる付箋ドラッグ。HTML5 DnD を使わず、
 * 自由配置（任意座標）とゾーン（トレイ / 机 / ゴミ箱）ヒット判定を両立する。
 */
export function useDeskDrag({ zones, onDrop, onHover }: Args) {
  const [visual, setVisual] = useState<DragVisual | null>(null);
  const grab = useRef<{ id: string; offsetX: number; offsetY: number; w: number; h: number } | null>(
    null,
  );

  const hitTest = useCallback(
    (x: number, y: number): ZoneName | null => {
      // 小さく前面にあるものを優先：ゴミ箱 → トレイ → 机。
      const order: ZoneName[] = ['trash', 'tray', 'desk'];
      for (const name of order) {
        const el = zones.find((z) => z.name === name)?.ref.current;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return name;
      }
      return null;
    },
    [zones],
  );

  const begin = useCallback(
    (id: string, e: React.PointerEvent, noteEl: HTMLElement) => {
      e.preventDefault();
      const r = noteEl.getBoundingClientRect();
      const g = { id, offsetX: e.clientX - r.left, offsetY: e.clientY - r.top, w: r.width, h: r.height };
      grab.current = g;
      setVisual({ id, left: r.left, top: r.top, width: r.width, height: r.height });

      const move = (ev: PointerEvent) => {
        const s = grab.current;
        if (!s) return;
        setVisual({ id, left: ev.clientX - s.offsetX, top: ev.clientY - s.offsetY, width: s.w, height: s.h });
        onHover?.(hitTest(ev.clientX, ev.clientY));
      };

      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const s = grab.current;
        grab.current = null;
        onHover?.(null);
        setVisual(null);
        if (!s) return;

        const zone = hitTest(ev.clientX, ev.clientY);
        if (!zone) return; // 領域外ドロップ → 変更なし

        let deskPos: Position | null = null;
        if (zone === 'desk') {
          const deskEl = zones.find((z) => z.name === 'desk')?.ref.current;
          if (deskEl) {
            const dr = deskEl.getBoundingClientRect();
            let px = ev.clientX - s.offsetX - dr.left;
            let py = ev.clientY - s.offsetY - dr.top;
            px = Math.max(0, Math.min(px, Math.max(0, dr.width - s.w)));
            py = Math.max(0, Math.min(py, Math.max(0, dr.height - s.h)));
            deskPos = { x: px, y: py };
          }
        }
        onDrop(s.id, zone, deskPos);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [zones, onDrop, onHover, hitTest],
  );

  return { dragId: visual?.id ?? null, visual, begin };
}
