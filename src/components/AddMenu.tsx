import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ItemType } from '../storage/deskLayout';

interface Props {
  /** 開いた瞬間の「＋」ボタン矩形（画面座標）。メニューの位置決めに使う。 */
  anchor: DOMRect;
  onPick: (type: ItemType) => void;
  onClose: () => void;
}

interface MenuItem {
  type: ItemType;
  icon: string;
  label: string;
  desc: string;
}

const MENU: MenuItem[] = [
  { type: 'text', icon: '📝', label: 'テキスト', desc: '自由に書けるメモ' },
  { type: 'image', icon: '🖼', label: '画像', desc: 'ファイルから貼る' },
  { type: 'video', icon: '🎬', label: '動画', desc: 'ファイルから貼る' },
  { type: 'embed', icon: '▶️', label: 'YouTube / 動画URL', desc: 'URLを貼って埋め込む' },
  { type: 'url', icon: '🔗', label: 'URL', desc: 'リンクを貼る' },
];

const POPUP_W = 240;

/** 左下「＋」から開く、机に貼れるコンテンツの一覧ポップオーバー（上方向に開く）。 */
export function AddMenu({ anchor, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // 開閉ボタン自身のクリックはトグル側に任せる。
      if (ref.current && !ref.current.contains(t) && !t.closest('.add-fab')) onClose();
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

  // ボタンの上に出し、左端がはみ出さないよう収める。
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - POPUP_W - 8));
  const bottom = Math.max(8, window.innerHeight - anchor.top + 8);

  return createPortal(
    <div ref={ref} className="addmenu" style={{ left, bottom, width: POPUP_W }}>
      <div className="addmenu__title">机に貼る</div>
      <ul className="addmenu__list">
        {MENU.map((m) => (
          <li key={m.type}>
            <button className="addmenu__item" onClick={() => onPick(m.type)}>
              <span className="addmenu__icon">{m.icon}</span>
              <span className="addmenu__body">
                <span className="addmenu__name">{m.label}</span>
                <span className="addmenu__desc">{m.desc}</span>
              </span>
              <span className="addmenu__add">＋</span>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
