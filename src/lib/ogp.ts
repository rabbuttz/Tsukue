import type { OgData } from '../storage/deskLayout';

// PROTOTYPE: ブラウザから任意URLを直接 fetch すると CORS で弾かれるため、
// 公開プロキシ経由で取得して OGP メタタグを読む。
// ＝対象URLはこれらの事業者に送られる点に注意（プロトタイプ用の暫定実装）。
const TIMEOUT_MS = 12000;

/** 各プロバイダの取得（成功すれば OgData、失敗で例外／取得不可で null）。 */
type Provider = (url: string, signal: AbortSignal) => Promise<OgData | null>;

const PROVIDERS: Provider[] = [
  // Jina Reader … JSON で title / description / metadata(og:*) を返す。APIキー不要で安定。
  async (url, signal) => {
    const res = await fetch('https://r.jina.ai/' + url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`jina ${res.status}`);
    return ogFromJina(await res.json(), url);
  },
  // corsproxy.io … 生HTML（jina が落ちたときの控え）。
  async (url, signal) => {
    const res = await fetch('https://corsproxy.io/?url=' + encodeURIComponent(url), { signal });
    if (!res.ok) throw new Error(`corsproxy ${res.status}`);
    return parseOg(await res.text(), url);
  },
  // allorigins … { contents: "<html>" } で返す（さらなる控え）。
  async (url, signal) => {
    const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url), {
      signal,
    });
    if (!res.ok) throw new Error(`allorigins ${res.status}`);
    const data = await res.json();
    if (typeof data?.contents !== 'string') throw new Error('allorigins empty');
    return parseOg(data.contents, url);
  },
];

/** 相対URLを絶対URLに直す（失敗時はそのまま）。 */
function absolutize(image: string | undefined, base: string): string | undefined {
  if (!image) return undefined;
  try {
    return new URL(image, base).href;
  } catch {
    return image;
  }
}

/** Jina Reader の JSON レスポンスから OGP を組み立てる。 */
function ogFromJina(json: unknown, url: string): OgData | null {
  const data = (json as { data?: Record<string, unknown> } | null)?.data;
  if (!data) return null;
  const meta = (data.metadata as Record<string, unknown>) || {};
  const pick = (key: string): string | undefined =>
    typeof meta[key] === 'string' ? (meta[key] as string) : undefined;

  return {
    title: pick('og:title') || (typeof data.title === 'string' ? data.title : undefined),
    description:
      pick('og:description') ||
      pick('description') ||
      (typeof data.description === 'string' ? data.description : undefined),
    image: absolutize(pick('og:image') || pick('og:image:url') || pick('twitter:image'), url),
    siteName: pick('og:site_name'),
    fetched: true,
  };
}

/** 生HTMLから OGP メタタグを読む。 */
function parseOg(html: string, url: string): OgData {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const pick = (key: string): string | undefined =>
    doc.querySelector(`meta[property="${key}"]`)?.getAttribute('content') ||
    doc.querySelector(`meta[name="${key}"]`)?.getAttribute('content') ||
    undefined;

  const title = pick('og:title') || doc.querySelector('title')?.textContent?.trim() || undefined;

  return {
    title,
    description: pick('og:description') || pick('description'),
    image: absolutize(pick('og:image') || pick('twitter:image'), url),
    siteName: pick('og:site_name'),
    fetched: true,
  };
}

/** 指定URLの OGP（og:title / og:description / og:image / og:site_name）を取得する。 */
export async function fetchOgp(url: string): Promise<OgData> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (const provider of PROVIDERS) {
      try {
        const og = await provider(url, controller.signal);
        // 何か取れたものだけ採用（空なら次のプロバイダへ）。
        if (og && (og.title || og.image || og.description)) return og;
      } catch {
        // 次のプロバイダへフォールバック。
      }
    }
    return { fetched: true }; // すべて失敗：取得済み扱いにして再試行を止める。
  } finally {
    window.clearTimeout(timer);
  }
}
