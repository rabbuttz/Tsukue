import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseTasks } from '../state/useTasks';
import { useDeskDrag } from '../hooks/useDeskDrag';
import type { Zone, ZoneName } from '../hooks/useDeskDrag';
import { useDeskWidgets } from '../state/useDeskWidgets';
import type { ItemType, WidgetKind } from '../storage/deskLayout';
import { loadImageFile, loadVideoFile } from '../lib/image';
import { classifyEmbed } from '../lib/embed';
import { Tray } from './Tray';
import { DeskSurface } from './DeskSurface';
import { TrashBin } from './TrashBin';
import { StickyNote } from './StickyNote';
import { WidgetPicker } from './WidgetPicker';
import { WidgetView } from './WidgetView';
import { AddMenu } from './AddMenu';

interface Props {
  store: UseTasks;
  now: number;
}

/** 貼り付けテキストが単一の http(s) URL かどうか（空白を含まず、ホスト名にドットを持つ）。 */
function isUrl(text: string): boolean {
  if (/\s/.test(text)) return false;
  const withProto = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const u = new URL(withProto);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

export function DeskView({ store, now }: Props) {
  const trayRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState<ZoneName | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null);
  // ピッカーのプレビューを机へドラッグ＆ドロップして追加するための状態。
  const [widgetDrag, setWidgetDrag] = useState<{ kind: WidgetKind; x: number; y: number } | null>(
    null,
  );
  const widgetCloneRef = useRef<HTMLDivElement>(null);

  const widgets = useDeskWidgets();
  const widgetCounts = useMemo(() => {
    const c: Record<WidgetKind, number> = {
      pomodoro: 0,
      clock: 0,
      digitalClock: 0,
      alarm: 0,
      ambient: 0,
      focusMeter: 0,
      plant: 0,
    };
    for (const w of widgets.widgets) c[w.kind]++;
    return c;
  }, [widgets.widgets]);

  const todo = store.byStatus('todo');
  const inProgress = store.byStatus('inProgress');
  const doneTasks = store.byStatus('done');

  const zones: Zone[] = useMemo(
    () => [
      { name: 'tray', ref: trayRef },
      { name: 'desk', ref: deskRef },
      { name: 'trash', ref: trashRef },
    ],
    [],
  );

  const { dragId, visual, begin } = useDeskDrag({
    zones,
    onHover: setHover,
    onDrop: (id, zone, deskPos) => {
      if (zone === 'tray') store.moveToTray(id);
      else if (zone === 'trash') store.moveToTrash(id);
      else if (zone === 'desk' && deskPos) store.moveToDesk(id, deskPos);
    },
  });

  const draggedTask = dragId ? store.tasks.find((t) => t.id === dragId) ?? null : null;

  const onPickImages = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const { src, w, h } = await loadImageFile(file);
        widgets.addImage(src, w, h);
      } catch {
        // 読み込めない画像はスキップ（プロトタイプ方針）。
      }
    }
  };

  const onPickVideos = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('video/')) continue;
      try {
        const { src, w, h } = await loadVideoFile(file);
        widgets.addVideo(src, w, h);
      } catch {
        // 読み込めない動画はスキップ（プロトタイプ方針）。
      }
    }
  };

  // 左下「＋」メニューの選択に応じて、その場で追加するかファイル選択を開く。
  const onPickType = (type: ItemType) => {
    setAddAnchor(null);
    if (type === 'text') widgets.addText();
    else if (type === 'url') widgets.addUrl();
    else if (type === 'embed') widgets.addEmbed();
    else if (type === 'image') imageInputRef.current?.click();
    else if (type === 'video') videoInputRef.current?.click();
  };

  // ピッカーのプレビューを掴んで机へドロップするとウィジェットを追加する。
  const beginWidgetAdd = (kind: WidgetKind, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setPickerAnchor(null); // ピッカーを閉じてクローンだけ追従させる。
    setWidgetDrag({ kind, x: e.clientX, y: e.clientY });

    const insideDesk = (x: number, y: number) => {
      const d = deskRef.current?.getBoundingClientRect();
      return !!d && x >= d.left && x <= d.right && y >= d.top && y <= d.bottom;
    };

    const move = (ev: PointerEvent) => {
      setWidgetDrag({ kind, x: ev.clientX, y: ev.clientY });
      setHover(insideDesk(ev.clientX, ev.clientY) ? 'desk' : null);
    };

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setHover(null);
      const desk = deskRef.current?.getBoundingClientRect();
      const clone = widgetCloneRef.current?.getBoundingClientRect();
      setWidgetDrag(null);
      if (!desk || !insideDesk(ev.clientX, ev.clientY)) return; // 机の外は追加しない
      // クローンの左上を基準に机面相対座標を出し、机の中に収める。
      const cw = clone?.width ?? 168;
      const ch = clone?.height ?? 168;
      const x = Math.max(0, Math.min(ev.clientX - cw / 2 - desk.left, Math.max(0, desk.width - cw)));
      const y = Math.max(0, Math.min(ev.clientY - ch / 2 - desk.top, Math.max(0, desk.height - ch)));
      widgets.add(kind, { x, y });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Ctrl/⌘+V でクリップボードの画像・動画・テキストを机に貼る。
  // 付箋本文や入力欄を編集中の貼り付けはそのまま通す（横取りしない）。
  const { addImage, addVideo, addText, addUrl, addEmbed } = widgets;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) return;
      const dt = e.clipboardData;
      if (!dt) return;

      // クリップボード内のファイル（スクショ・コピーした画像／動画）を集める。
      let files = dt.files && dt.files.length ? Array.from(dt.files) : [];
      if (!files.length) {
        files = Array.from(dt.items)
          .filter((it) => it.kind === 'file')
          .map((it) => it.getAsFile())
          .filter((f): f is File => f !== null);
      }

      const imageFile = files.find((f) => f.type.startsWith('image/'));
      if (imageFile) {
        e.preventDefault();
        loadImageFile(imageFile)
          .then(({ src, w, h }) => addImage(src, w, h))
          .catch(() => {});
        return;
      }
      const videoFile = files.find((f) => f.type.startsWith('video/'));
      if (videoFile) {
        e.preventDefault();
        loadVideoFile(videoFile)
          .then(({ src, w, h }) => addVideo(src, w, h))
          .catch(() => {});
        return;
      }

      // テキスト：YouTube/Vimeo/動画URL は埋め込み、ふつうのURLはURLカード、
      // それ以外はテキスト付箋。
      const text = dt.getData('text/plain').trim();
      if (!text) return;
      e.preventDefault();
      const embed = classifyEmbed(text);
      if (embed && embed.kind !== 'link') addEmbed(text);
      else if (isUrl(text)) addUrl(text);
      else addText(text);
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addImage, addVideo, addText, addUrl, addEmbed]);

  return (
    <div className="desk-view">
      <header className="toolbar">
        <div className="toolbar__left">
          <div className="brand">
            Tsukue<span className="brand__dot" />
          </div>
          <span className="proto-badge" title="保存はブラウザの localStorage。将来サーバーへ移行予定。">
            プロトタイプ · localStorage 保存
          </span>
        </div>
        <div className="toolbar__right">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              onPickImages(e.target.files);
              e.target.value = ''; // 同じファイルを連続で選べるようにリセット。
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              onPickVideos(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            className="widget-add"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPickerAnchor((a) => (a ? null : rect));
            }}
            title="アナログ時計などのウィジェットを追加"
          >
            ＋ ウィジェット
          </button>
        </div>
      </header>

      {pickerAnchor && (
        <WidgetPicker
          anchor={pickerAnchor}
          now={now}
          tasks={store.tasks}
          counts={widgetCounts}
          onPickStart={beginWidgetAdd}
          onClose={() => setPickerAnchor(null)}
        />
      )}

      {addAnchor && (
        <AddMenu anchor={addAnchor} onPick={onPickType} onClose={() => setAddAnchor(null)} />
      )}

      <div className="work-area">
        <Tray
          ref={trayRef}
          tasks={todo}
          now={now}
          dragId={dragId}
          hovered={hover === 'tray'}
          onDragStart={begin}
          onContentChange={store.updateContent}
          onDateChange={store.updateDate}
          onColorChange={store.updateColor}
          onFontSizeChange={store.updateFontSize}
          onAdd={() => store.addTask()}
        />

        <div className="desk-wrap">
          <DeskSurface
            ref={deskRef}
            tasks={inProgress}
            allTasks={store.tasks}
            now={now}
            dragId={dragId}
            hovered={hover === 'desk'}
            widgets={widgets.widgets}
            onWidgetMove={widgets.move}
            onWidgetRemove={widgets.remove}
            onWidgetResize={widgets.resize}
            items={widgets.items}
            onItemMove={widgets.moveItem}
            onItemRemove={widgets.removeItem}
            onItemResize={widgets.resizeItem}
            onItemChange={widgets.updateItem}
            onDragStart={begin}
            onContentChange={store.updateContent}
            onDateChange={store.updateDate}
            onColorChange={store.updateColor}
            onFontSizeChange={store.updateFontSize}
          />
          <TrashBin
            ref={trashRef}
            hovered={hover === 'trash'}
            doneTasks={doneTasks}
            now={now}
            onRestore={store.restoreFromTrash}
            onDelete={store.removeTask}
          />
        </div>
      </div>

      {/* 左下「＋」：テキスト・画像・動画・URL を机に貼る入口 */}
      <button
        className={`add-fab${addAnchor ? ' add-fab--on' : ''}`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setAddAnchor((a) => (a ? null : rect));
        }}
        title="テキスト・画像・動画・URLを机に貼る"
        aria-label="コンテンツを追加"
      >
        ＋
      </button>

      {/* ドラッグ中の付箋（ポインタ追従オーバーレイ） */}
      {visual && draggedTask && (
        <div
          className="drag-layer"
          style={{ left: visual.left, top: visual.top, width: visual.width }}
        >
          <StickyNote
            task={draggedTask}
            now={now}
            dragging
            onDragStart={() => {}}
            onContentChange={() => {}}
            onDateChange={() => {}}
          />
        </div>
      )}

      {/* ピッカーから掴んだウィジェットのドラッグ中クローン（ポインタ追従） */}
      {widgetDrag && (
        <div
          ref={widgetCloneRef}
          className="widget-drag-clone"
          style={{ left: widgetDrag.x, top: widgetDrag.y }}
        >
          <WidgetView kind={widgetDrag.kind} now={now} tasks={store.tasks} />
        </div>
      )}
    </div>
  );
}
