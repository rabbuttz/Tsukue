import { useState } from 'react';

interface Pos {
  x: number;
  y: number;
}

/** これ以上ポインタが動いたら「移動」とみなす閾値（px）。未満はクリック扱い。 */
const DRAG_THRESHOLD = 5;

/**
 * 机上オブジェクト（ウィジェット／アイテム）の本体ドラッグ移動。
 * onPointerDown を要素に付け、掴んだ要素＝机の直接の子であることを前提に、
 * 机面内へクランプした座標を算出する。確定時に onCommit を呼ぶ。
 *
 * 専用の「掴みハンドル」を出さずに本文の上から直接動かせるよう、閾値方式を採る：
 * ポインタが少し動いて初めて移動を開始し、ほぼ動かないクリックは素通しする
 * （テキスト編集・リンク・再生ボタンなどはそのまま反応する）。
 * ドラッグ終端で誤発火するクリックは1回だけ無効化する。
 */
export function useObjectMove(
  base: Pos,
  onCommit: (x: number, y: number) => void,
  /** この要素の上では掴まない（×ボタンやリサイズハンドルなど）。 */
  ignoreSelector?: string,
) {
  const [drag, setDrag] = useState<Pos | null>(null);

  const begin = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (ignoreSelector && (e.target as HTMLElement).closest(ignoreSelector)) return;
    const card = e.currentTarget as HTMLElement;
    const desk = card.parentElement; // オブジェクトは .desk の直接の子。
    if (!desk) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const cr = card.getBoundingClientRect();
    const offsetX = e.clientX - cr.left;
    const offsetY = e.clientY - cr.top;
    const { width: w, height: h } = cr;
    let started = false;
    let latest: Pos = { x: base.x, y: base.y };

    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        // ここで初めて移動開始：編集中なら抜け、選択を消し、テキスト選択を止める。
        started = true;
        const active = document.activeElement as HTMLElement | null;
        if (active && card.contains(active)) active.blur();
        window.getSelection?.()?.removeAllRanges();
        document.body.style.userSelect = 'none';
        setDrag(latest);
      }
      const dr = desk.getBoundingClientRect();
      const x = Math.max(0, Math.min(ev.clientX - offsetX - dr.left, Math.max(0, dr.width - w)));
      const y = Math.max(0, Math.min(ev.clientY - offsetY - dr.top, Math.max(0, dr.height - h)));
      latest = { x, y };
      setDrag(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!started) return; // 動いていない＝ただのクリック。そのまま素通し。
      document.body.style.userSelect = '';
      setDrag(null);
      onCommit(latest.x, latest.y);
      // ドラッグ直後に発火するクリック（ボタン/リンクの誤爆）を1回だけ握りつぶす。
      const swallow = (ce: MouseEvent) => {
        ce.stopPropagation();
        ce.preventDefault();
        window.removeEventListener('click', swallow, true);
      };
      window.addEventListener('click', swallow, true);
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return { drag, begin };
}
