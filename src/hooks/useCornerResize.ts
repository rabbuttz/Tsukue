import { useCallback } from 'react';

/**
 * 右下ハンドルを掴んでのリサイズ。ハンドルの onPointerDown に付ける。
 * 開始点からのドラッグ量 (dx, dy) を逐次通知し、指を離したら done=true で確定。
 * 具体的なサイズ計算（等倍スケール／縦横比固定など）は呼び出し側に委ねる。
 */
export function useCornerResize(onResize: (dx: number, dy: number, done: boolean) => void) {
  return useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // 本体ドラッグ（移動）へ伝播させない。
      e.preventDefault();
      e.stopPropagation();
      const sx = e.clientX;
      const sy = e.clientY;

      const move = (ev: PointerEvent) => onResize(ev.clientX - sx, ev.clientY - sy, false);
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        onResize(ev.clientX - sx, ev.clientY - sy, true);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [onResize],
  );
}
