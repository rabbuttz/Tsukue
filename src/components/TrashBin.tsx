import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Task } from '../types';
import { formatElapsed, formatJpDate } from '../lib/date';
import { elapsedMs } from '../lib/elapsed';

interface Props {
  hovered: boolean;
  doneTasks: Task[];
  now: number;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

/** ゴミ箱。付箋をドロップで完了。クリックで中身を開き、戻す／完全削除ができる。 */
export const TrashBin = forwardRef<HTMLDivElement, Props>(function TrashBin(
  { hovered, doneTasks, now, onRestore, onDelete },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 中身が空になったら自動で閉じる。
  useEffect(() => {
    if (open && doneTasks.length === 0) setOpen(false);
  }, [open, doneTasks.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const doneCount = doneTasks.length;

  const handleClick = (e: React.MouseEvent) => {
    if (doneCount === 0) return;
    setAnchor(e.currentTarget.getBoundingClientRect());
    setOpen((v) => !v);
  };

  return (
    <div
      ref={ref}
      data-trash
      className={`trash${hovered ? ' trash--hover' : ''}${open ? ' trash--open' : ''}`}
      title={doneCount === 0 ? 'ここに入れると完了' : 'クリックで完了一覧'}
      onClick={handleClick}
    >
      <svg className="trash__icon" viewBox="0 0 24 24" width="36" height="36" aria-hidden>
        <path
          fill="currentColor"
          d="M9 3a1 1 0 0 0-1 1v1H4.5a1 1 0 1 0 0 2H5l.84 12.07A2 2 0 0 0 7.83 21h8.34a2 2 0 0 0 1.99-1.93L19 7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9Zm1 2h4v0h-4Zm-.16 4a.75.75 0 0 1 .75.7l.4 7a.75.75 0 0 1-1.5.08l-.4-7a.75.75 0 0 1 .75-.78Zm4.32 0a.75.75 0 0 1 .75.78l-.4 7a.75.75 0 1 1-1.5-.08l.4-7a.75.75 0 0 1 .75-.7Z"
        />
      </svg>
      <span className="trash__label">完了</span>
      {doneCount > 0 && <span className="trash__count">{doneCount}</span>}

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            className="trashpanel"
            style={{
              left: Math.max(8, Math.min(anchor.left + anchor.width / 2 - 150, window.innerWidth - 308)),
              bottom: window.innerHeight - anchor.top + 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="trashpanel__head">
              <span className="trashpanel__title">完了したタスク</span>
              <span className="trashpanel__count">{doneCount}</span>
            </header>
            <ul className="trashpanel__list">
              {doneTasks.map((t) => (
                <li key={t.id} className="trashitem">
                  <span className={`trashitem__chip trashitem__chip--${t.color}`} aria-hidden />
                  <div className="trashitem__body">
                    <div className="trashitem__content">{t.content.trim() || '(無題)'}</div>
                    <div className="trashitem__meta">
                      {formatJpDate(t.date)}
                      {elapsedMs(t, now) > 0 && <> · ⏱ {formatElapsed(elapsedMs(t, now))}</>}
                    </div>
                  </div>
                  <div className="trashitem__actions">
                    <button className="trashitem__restore" onClick={() => onRestore(t.id)} title="To Do に戻す">
                      ↩ 戻す
                    </button>
                    <button
                      className="trashitem__delete"
                      onClick={() => onDelete(t.id)}
                      title="完全に削除"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
});
