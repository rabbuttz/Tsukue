// PROTOTYPE: 机上のウィジェット（ポモドーロ/時計など）の配置を localStorage に保持する暫定実装。
// タスク本体（TaskRepository）とは別系統のレイアウト情報。将来はサーバーへ移行予定。
const LAYOUT_KEY = 'tsukue.deskLayout.v1';

export type WidgetKind = 'pomodoro' | 'clock' | 'digitalClock' | 'alarm';

export interface PlacedWidget {
  /** 配置されたウィジェットのインスタンスID。 */
  id: string;
  kind: WidgetKind;
  /** 机面相対座標（px）。 */
  x: number;
  y: number;
  /** 拡大率（1=等倍）。右下ハンドルのドラッグで変える。未指定は1扱い。 */
  scale?: number;
}

/** 左下「＋」から貼れるコンテンツの種類。embed は URL から埋め込む動画（YouTube 等）。 */
export type ItemType = 'text' | 'image' | 'video' | 'url' | 'embed';

/** URL アイテムの OGP（Open Graph）取得結果。 */
export interface OgData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  /** 取得を試行済みか（成功／失敗を問わず。再取得の抑止に使う）。 */
  fetched?: boolean;
}

/**
 * 机の上に貼ったコンテンツ1つ（テキスト／画像／動画／URL）。
 * 位置(x,y)と表示サイズ(w,h)は共通。種類ごとに使うフィールドが異なる。
 * 画像・動画の src、URL の url は dataURL/文字列を localStorage に直接保持（プロトタイプ）。
 */
export interface PlacedItem {
  id: string;
  type: ItemType;
  /** 机面相対座標（px）。 */
  x: number;
  y: number;
  /** 表示サイズ（px）。右下ハンドルで変える（画像・動画は縦横比を保つ）。 */
  w: number;
  h: number;
  /** text: 本文。 */
  text?: string;
  /** image / video: dataURL（または外部URL）。 */
  src?: string;
  /** url / embed: リンク先・埋め込み元URL（確定後は変更不可）。 */
  url?: string;
  /** url: OGP取得結果。 */
  og?: OgData;
  /** url: OGPプレビューの表示ON/OFF（未指定は表示扱い）。 */
  showOg?: boolean;
}

export interface WidgetCatalogItem {
  kind: WidgetKind;
  label: string;
  icon: string;
  desc: string;
}

/** 追加できるウィジェットの一覧（ウィジェット選択UIの元データ）。 */
export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  { kind: 'pomodoro', label: 'ポモドーロタイマー', icon: '🍅', desc: '25分集中・5分休憩' },
  { kind: 'clock', label: 'アナログ時計', icon: '🕐', desc: '今の時刻をひと目で' },
  { kind: 'digitalClock', label: 'デジタル時計', icon: '⌚', desc: '時刻を数字で表示' },
  { kind: 'alarm', label: 'アラーム', icon: '⏰', desc: '指定時刻にお知らせ' },
];

export interface DeskLayout {
  widgets: PlacedWidget[];
  items: PlacedItem[];
}

/** 初回（保存データなし）の既定配置：ポモドーロを左上に1つ。 */
export const DEFAULT_DESK_LAYOUT: DeskLayout = {
  widgets: [{ id: 'pomodoro-default', kind: 'pomodoro', x: 18, y: 18 }],
  items: [],
};

function isKind(v: unknown): v is WidgetKind {
  return v === 'pomodoro' || v === 'clock' || v === 'digitalClock' || v === 'alarm';
}

function coerceWidget(raw: unknown): PlacedWidget | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isKind(r.kind)) return null;
  const scale = Number(r.scale);
  return {
    id: typeof r.id === 'string' ? r.id : `w_${r.kind}`,
    kind: r.kind,
    x: Number.isFinite(Number(r.x)) ? Number(r.x) : 18,
    y: Number.isFinite(Number(r.y)) ? Number(r.y) : 18,
    ...(Number.isFinite(scale) && scale > 0 ? { scale } : {}),
  };
}

function isItemType(v: unknown): v is ItemType {
  return v === 'text' || v === 'image' || v === 'video' || v === 'url' || v === 'embed';
}

function coerceItem(raw: unknown): PlacedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isItemType(r.type)) return null;
  const w = Number(r.w);
  const h = Number(r.h);
  const item: PlacedItem = {
    id: typeof r.id === 'string' ? r.id : `item_${Math.random().toString(36).slice(2, 8)}`,
    type: r.type,
    x: Number.isFinite(Number(r.x)) ? Number(r.x) : 28,
    y: Number.isFinite(Number(r.y)) ? Number(r.y) : 28,
    w: Number.isFinite(w) && w > 0 ? w : 200,
    h: Number.isFinite(h) && h > 0 ? h : 150,
  };
  if (typeof r.text === 'string') item.text = r.text;
  if (typeof r.src === 'string') item.src = r.src;
  if (typeof r.url === 'string') item.url = r.url;
  if (typeof r.showOg === 'boolean') item.showOg = r.showOg;
  if (r.og && typeof r.og === 'object') {
    const o = r.og as Record<string, unknown>;
    item.og = {
      title: typeof o.title === 'string' ? o.title : undefined,
      description: typeof o.description === 'string' ? o.description : undefined,
      image: typeof o.image === 'string' ? o.image : undefined,
      siteName: typeof o.siteName === 'string' ? o.siteName : undefined,
      fetched: o.fetched === true,
    };
  }
  return item;
}

/** 旧形式の画像配列（images）を新しい items（type:'image'）へ変換する。 */
function coerceLegacyImage(raw: unknown): PlacedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.src !== 'string' || !r.src) return null;
  const w = Number(r.w);
  const h = Number(r.h);
  return {
    id: typeof r.id === 'string' ? r.id : `item_${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    src: r.src,
    x: Number.isFinite(Number(r.x)) ? Number(r.x) : 28,
    y: Number.isFinite(Number(r.y)) ? Number(r.y) : 28,
    w: Number.isFinite(w) && w > 0 ? w : 200,
    h: Number.isFinite(h) && h > 0 ? h : 150,
  };
}

export function loadDeskLayout(): DeskLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_DESK_LAYOUT;
    const parsed = JSON.parse(raw);

    // 新形式：widgets 配列（＋ items、旧 images）。
    if (Array.isArray(parsed?.widgets)) {
      // items が新形式。無ければ旧 images から移行する。
      const items: PlacedItem[] = Array.isArray(parsed?.items)
        ? parsed.items
            .map(coerceItem)
            .filter((it: PlacedItem | null): it is PlacedItem => it !== null)
        : Array.isArray(parsed?.images)
          ? parsed.images
              .map(coerceLegacyImage)
              .filter((it: PlacedItem | null): it is PlacedItem => it !== null)
          : [];
      return {
        widgets: parsed.widgets
          .map(coerceWidget)
          .filter((w: PlacedWidget | null): w is PlacedWidget => w !== null),
        items,
      };
    }
    // 旧形式：{ pomodoro: {x,y} } → 単一ポモドーロへ移行。
    if (parsed?.pomodoro) {
      return {
        widgets: [
          {
            id: 'pomodoro-default',
            kind: 'pomodoro',
            x: Number(parsed.pomodoro.x ?? 18),
            y: Number(parsed.pomodoro.y ?? 18),
          },
        ],
        items: [],
      };
    }
    return DEFAULT_DESK_LAYOUT;
  } catch {
    // 壊れたデータは無視して既定配置から始める（プロトタイプ方針）。
    return DEFAULT_DESK_LAYOUT;
  }
}

export function saveDeskLayout(layout: DeskLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // 容量超過などは握りつぶす（プロトタイプ方針）。
  }
}
