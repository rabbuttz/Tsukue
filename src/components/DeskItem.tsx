import { useEffect, useState } from 'react';
import type { PlacedItem } from '../storage/deskLayout';
import { useObjectMove } from '../hooks/useObjectMove';
import { useCornerResize } from '../hooks/useCornerResize';
import { fetchOgp } from '../lib/ogp';
import { classifyEmbed } from '../lib/embed';

interface Props {
  item: PlacedItem;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, w: number, h: number) => void;
  onChange: (id: string, patch: Partial<PlacedItem>) => void;
}

const MIN_W = 60;
const MAX_W = 900;
const MIN_H = 48;
const MAX_H = 900;

/** OGPプレビュー表示時／非表示時の既定の高さ。 */
const OG_OPEN_H = 290;
const OG_COLLAPSED_H = 76;

/** http(s) のみ許可した安全な href を返す（不正なら null）。 */
function safeHref(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch {
    /* 不正なURL */
  }
  return null;
}

/**
 * 机に貼った1つのコンテンツ（テキスト／画像／動画／URL／埋め込み）。
 * 位置・ドラッグ移動・リサイズ・取り外し・編集を受け持つ。
 * 画像・動画・埋め込みは縦横比を保ってリサイズ、テキスト・URLは自由リサイズ。
 */
export function DeskItem({ item, onMove, onRemove, onResize, onChange }: Props) {
  // リサイズ中のプレビュー寸法（確定までは保存しない）。
  const [live, setLive] = useState<{ w: number; h: number } | null>(null);

  const w = live?.w ?? item.w;
  const h = live?.h ?? item.h;
  const lockAspect = item.type === 'image' || item.type === 'video' || item.type === 'embed';
  const aspect = item.w / item.h;

  // 本文の上から直接ドラッグで移動できる（閾値方式。クリックは編集・再生・リンクに素通し）。
  // 取り外し／リサイズのハンドル上だけは掴まない。
  const { drag, begin } = useObjectMove(
    { x: item.x, y: item.y },
    (x, y) => onMove(item.id, x, y),
    '.deskitem__remove, .deskitem__resize',
  );

  const beginResize = useCornerResize((dx, dy, done) => {
    let nextW = Math.max(MIN_W, Math.min(MAX_W, item.w + dx));
    let nextH: number;
    if (lockAspect) {
      nextH = Math.round(nextW / aspect);
    } else {
      nextH = Math.max(MIN_H, Math.min(MAX_H, item.h + dy));
    }
    nextW = Math.round(nextW);
    if (done) {
      setLive(null);
      onResize(item.id, nextW, nextH);
    } else {
      setLive({ w: nextW, h: nextH });
    }
  });

  const x = drag?.x ?? item.x;
  const y = drag?.y ?? item.y;

  return (
    <div
      className={`deskitem deskitem--${item.type}${drag ? ' deskitem--dragging' : ''}${
        live ? ' deskitem--resizing' : ''
      }`}
      style={{ left: x, top: y, width: w, height: h }}
      onPointerDown={begin}
    >
      <button
        className="deskitem__remove"
        onClick={() => onRemove(item.id)}
        title="外す"
        aria-label="外す"
      >
        ×
      </button>

      {item.type === 'text' && (
        <textarea
          className="deskitem__text"
          placeholder="メモを書く…"
          value={item.text ?? ''}
          onChange={(e) => onChange(item.id, { text: e.target.value })}
        />
      )}

      {item.type === 'image' && (
        <img className="deskitem__img" src={item.src} alt="" draggable={false} />
      )}

      {item.type === 'video' && (
        <video className="deskitem__video" src={item.src} controls playsInline preload="metadata" />
      )}

      {item.type === 'url' && <UrlCard item={item} onChange={onChange} />}

      {item.type === 'embed' && <EmbedCard item={item} onChange={onChange} />}

      <span
        className="deskitem__resize"
        title="ドラッグで大きさを変える"
        aria-label="大きさを変える"
        onPointerDown={beginResize}
      />
    </div>
  );
}

/** このセッションで OGP を取得（再取得含む）済みの URL。取りこぼしの1回だけ再取得＆ループ防止。 */
const ogFetched = new Set<string>();

/** URL アイテム。入力→Enterで確定すると入力欄は消え、OGPプレビューを表示（表示/非表示の切替つき）。 */
function UrlCard({
  item,
  onChange,
}: {
  item: PlacedItem;
  onChange: (id: string, patch: Partial<PlacedItem>) => void;
}) {
  const [draft, setDraft] = useState(item.url ?? '');
  // og:image の読み込み失敗（リンク切れ・ホットリンク禁止など）を覚えて favicon に切り替える。
  const [imgFailed, setImgFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const confirmed = !!item.url;
  const showOg = item.showOg !== false;
  const href = confirmed ? safeHref(item.url ?? '') : null;
  const hostname = href ? new URL(href).hostname : '';
  // og に中身（タイトル/画像/説明）が1つも無ければ「取得失敗」とみなす。
  const ogHasContent = !!(item.og && (item.og.title || item.og.image || item.og.description));
  const loading = confirmed && (!item.og || retrying); // 未取得／再取得中
  // og:image が無い／失敗したときの控え：サイトの favicon（プロキシ不要）。
  const favicon = hostname
    ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`
    : '';
  const ogImage = item.og?.image && !imgFailed ? item.og.image : null;

  // 未取得、または過去に取りこぼした（中身ゼロの）og を、セッション中1度だけ取得する。
  useEffect(() => {
    if (!item.url || ogHasContent) return;
    if (ogFetched.has(item.url)) return; // このセッションで取得試行済み → 再試行しない
    ogFetched.add(item.url);
    let cancelled = false;
    setRetrying(true);
    fetchOgp(item.url)
      .then((og) => {
        if (!cancelled) onChange(item.id, { og });
      })
      .catch(() => {
        if (!cancelled) onChange(item.id, { og: { fetched: true } });
      })
      .finally(() => {
        if (!cancelled) setRetrying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.url, ogHasContent, item.id, onChange]);

  const commit = () => {
    const h = safeHref(draft);
    if (!h) return; // 無効なら確定しない（入力のまま）
    onChange(item.id, { url: h, showOg: true, w: Math.max(item.w, 300), h: OG_OPEN_H });
  };

  // 未確定：URL入力欄を表示。
  if (!confirmed) {
    return (
      <div className="ogcard ogcard--edit">
        <input
          className="deskitem__urlinput"
          type="url"
          autoFocus
          placeholder="https://… を貼り付け"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
        />
        <span className="deskitem__urlhint">URL を入力して Enter で確定</span>
      </div>
    );
  }

  // 確定後：OGPプレビュー（表示/非表示を切替可能）。
  return (
    <div className={`ogcard${showOg ? '' : ' ogcard--collapsed'}`}>
      <a
        className="ogcard__main"
        href={href ?? undefined}
        target="_blank"
        rel="noreferrer noopener"
        draggable={false}
      >
        {showOg && (
          <span className="ogcard__thumb">
            {ogImage ? (
              <img src={ogImage} alt="" draggable={false} onError={() => setImgFailed(true)} />
            ) : loading ? (
              <span className="ogcard__thumb-fallback">⏳</span>
            ) : favicon ? (
              <img
                className="ogcard__favicon"
                src={favicon}
                alt=""
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="ogcard__thumb-fallback">🔗</span>
            )}
          </span>
        )}
        <span className="ogcard__body">
          {showOg && (
            <span className="ogcard__title">
              {item.og?.title || (loading ? '読み込み中…' : hostname)}
            </span>
          )}
          {showOg && item.og?.description && (
            <span className="ogcard__desc">{item.og.description}</span>
          )}
          <span className="ogcard__host">🔗 {hostname} ↗</span>
        </span>
      </a>
      <button
        className="ogcard__toggle"
        onClick={() =>
          onChange(item.id, { showOg: !showOg, h: !showOg ? OG_OPEN_H : OG_COLLAPSED_H })
        }
        title="OGPプレビューの表示を切り替え"
      >
        {showOg ? '隠す' : 'プレビュー'}
      </button>
    </div>
  );
}

const EMBED_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  video: '動画',
  link: 'リンク',
};

/** 埋め込みアイテム。URL を貼って Enter で確定すると、YouTube/Vimeo は iframe、
 *  直リンク動画は <video> で机の上に再生表示する。上部バーを掴んで移動する。 */
function EmbedCard({
  item,
  onChange,
}: {
  item: PlacedItem;
  onChange: (id: string, patch: Partial<PlacedItem>) => void;
}) {
  const [draft, setDraft] = useState(item.url ?? '');
  const info = item.url ? classifyEmbed(item.url) : null;

  const commit = () => {
    const parsed = classifyEmbed(draft);
    if (!parsed) return; // 空なら確定しない
    // YouTube / Vimeo は 16:9 に整える。
    const patch: Partial<PlacedItem> = { url: draft.trim() };
    if (parsed.kind === 'youtube' || parsed.kind === 'vimeo') {
      const w = Math.max(item.w, 320);
      patch.w = w;
      patch.h = Math.round((w * 9) / 16);
    }
    onChange(item.id, patch);
  };

  // 未確定：URL 入力欄。
  if (!info) {
    return (
      <div className="embedbox embedbox--edit">
        <input
          className="deskitem__urlinput"
          type="url"
          autoFocus
          placeholder="YouTube などの URL を貼り付け"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
        />
        <span className="deskitem__urlhint">URL を貼り付けて Enter で埋め込み</span>
      </div>
    );
  }

  // 確定後：上部バー（掴んで移動・元リンクを開く）＋プレビュー本体。
  return (
    <div className="embedbox">
      <div className="embedbox__bar">
        <span className="embedbox__label">⋮⋮ {EMBED_LABEL[info.kind]}</span>
        <a
          className="embedbox__open"
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          title="元のページを開く"
        >
          ↗
        </a>
      </div>

      {(info.kind === 'youtube' || info.kind === 'vimeo') && (
        <iframe
          className="embedbox__frame"
          src={info.src}
          title={EMBED_LABEL[info.kind]}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}

      {info.kind === 'video' && (
        <video className="embedbox__video" src={info.src} controls playsInline preload="metadata" />
      )}

      {info.kind === 'link' && (
        <a
          className="embedbox__fallback"
          href={info.src}
          target="_blank"
          rel="noreferrer noopener"
        >
          <span>このURLは埋め込み再生できません</span>
          <span className="embedbox__fallback-open">新しいタブで開く ↗</span>
        </a>
      )}
    </div>
  );
}
