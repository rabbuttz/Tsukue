/** 埋め込み（embed）アイテムの URL を種類ごとに解釈するユーティリティ。 */

export type EmbedKind = 'youtube' | 'vimeo' | 'video' | 'link';

export interface EmbedInfo {
  kind: EmbedKind;
  /** iframe / video 要素に渡す URL。link のときは元URL。 */
  src: string;
}

/** 直リンク動画として扱う拡張子。 */
const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i;

/** 開始秒（?t=90 / ?start=90 / 1m30s 形式）を秒数に直す。取れなければ null。 */
function startSeconds(u: URL): number | null {
  const raw = u.searchParams.get('start') ?? u.searchParams.get('t');
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!m) return null;
  const sec = (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  return sec > 0 ? sec : null;
}

/** YouTube の動画ID（11文字想定）を各種URL形から取り出す。取れなければ null。 */
export function youTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      if (m) return m[1];
    }
  } catch {
    /* 不正なURL */
  }
  return null;
}

/** Vimeo の動画ID（数字）を取り出す。取れなければ null。 */
export function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') !== 'vimeo.com') return null;
    const m = u.pathname.match(/\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * URL を埋め込み種別に分類する。
 * YouTube / Vimeo は iframe 用の埋め込みURL、直リンク動画は <video> 用URL、
 * それ以外は link（埋め込み不可）として元URLを返す。空文字なら null。
 */
export function classifyEmbed(rawUrl: string): EmbedInfo | null {
  const url = rawUrl.trim();
  if (!url) return null;
  const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const yt = youTubeId(withProto);
  if (yt) {
    let src = `https://www.youtube-nocookie.com/embed/${yt}`;
    try {
      const start = startSeconds(new URL(withProto));
      if (start) src += `?start=${start}`;
    } catch {
      /* 開始秒なし */
    }
    return { kind: 'youtube', src };
  }

  const vm = vimeoId(withProto);
  if (vm) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vm}` };

  if (VIDEO_EXT.test(withProto)) return { kind: 'video', src: withProto };

  return { kind: 'link', src: withProto };
}
