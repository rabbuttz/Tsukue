import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDeskLayout, saveDeskLayout } from '../storage/deskLayout';
import type { ItemType, PlacedItem, PlacedWidget, WidgetKind } from '../storage/deskLayout';

function makeWidgetId(kind: WidgetKind): string {
  return `w_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeItemId(type: ItemType): string {
  return `i_${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** メディアの初期表示サイズ：長辺がこの値に収まるよう縮める（机の上で大きすぎないように）。 */
const MEDIA_DEFAULT_MAX = 280;

/**
 * 机上オブジェクト（ウィジェット＋コンテンツアイテム）の配置を司る単一ソース。
 * 追加・削除・移動・リサイズ・編集を提供し、変更を自動保存する。
 * タスク（useTasks）とは独立した一時レイアウト状態。
 */
export function useDeskWidgets() {
  const initial = useRef(loadDeskLayout());
  const [widgets, setWidgets] = useState<PlacedWidget[]>(() => initial.current.widgets);
  const [items, setItems] = useState<PlacedItem[]>(() => initial.current.items);

  // 初回ロードはスキップし、以降の変更だけ保存する（useTasks と同方針）。
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveDeskLayout({ widgets, items });
  }, [widgets, items]);

  // ---- ウィジェット ----
  const add = useCallback((kind: WidgetKind, pos?: { x: number; y: number }) => {
    setWidgets((prev) => {
      if (pos) return [...prev, { id: makeWidgetId(kind), kind, x: pos.x, y: pos.y }];
      // 位置指定なし：既存と重ならないよう少しずつずらして置く。
      const offset = (prev.length % 6) * 26;
      return [...prev, { id: makeWidgetId(kind), kind, x: 28 + offset, y: 28 + offset }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const move = useCallback((id: string, x: number, y: number) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  const resize = useCallback((id: string, scale: number) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, scale } : w)));
  }, []);

  // ---- コンテンツアイテム（テキスト／画像／動画／URL） ----

  /** 新規アイテムを少しずつずらして机に追加する（左上の既定ウィジェットを避けた位置から）。 */
  const pushItem = useCallback((it: Omit<PlacedItem, 'id' | 'x' | 'y'>) => {
    setItems((prev) => {
      const offset = (prev.length % 6) * 28;
      return [...prev, { ...it, id: makeItemId(it.type), x: 240 + offset, y: 80 + offset }];
    });
  }, []);

  /** 自然サイズを長辺 MEDIA_DEFAULT_MAX に収めた表示サイズを返す。 */
  const fitMedia = (nw: number, nh: number) => {
    const ratio = Math.min(1, MEDIA_DEFAULT_MAX / Math.max(nw, nh));
    return { w: Math.max(1, Math.round(nw * ratio)), h: Math.max(1, Math.round(nh * ratio)) };
  };

  const addText = useCallback(
    (text = '') => {
      pushItem({ type: 'text', text, w: 220, h: 140 });
    },
    [pushItem],
  );

  const addImage = useCallback(
    (src: string, naturalW: number, naturalH: number) => {
      pushItem({ type: 'image', src, ...fitMedia(naturalW, naturalH) });
    },
    [pushItem],
  );

  const addVideo = useCallback(
    (src: string, naturalW: number, naturalH: number) => {
      pushItem({ type: 'video', src, ...fitMedia(naturalW, naturalH) });
    },
    [pushItem],
  );

  const addUrl = useCallback(
    (url = '') => {
      // URL 指定ありなら確定済み扱い（OGPプレビュー付きの大きさ）で置く。
      if (url) pushItem({ type: 'url', url, showOg: true, w: 300, h: 290 });
      else pushItem({ type: 'url', url: '', w: 260, h: 96 });
    },
    [pushItem],
  );

  const addEmbed = useCallback(
    (url = '') => {
      // 既定 320×180 は 16:9。YouTube/Vimeo の URL をそのまま渡せば即埋め込み表示になる。
      pushItem({ type: 'embed', url, w: 320, h: 180 });
    },
    [pushItem],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const moveItem = useCallback((id: string, x: number, y: number) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, x, y } : it)));
  }, []);

  const resizeItem = useCallback((id: string, w: number, h: number) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, w, h } : it)));
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<PlacedItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  return {
    widgets,
    add,
    remove,
    move,
    resize,
    items,
    addText,
    addImage,
    addVideo,
    addUrl,
    addEmbed,
    removeItem,
    moveItem,
    resizeItem,
    updateItem,
  };
}

export type UseDeskWidgets = ReturnType<typeof useDeskWidgets>;
