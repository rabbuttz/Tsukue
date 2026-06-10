export type Status = 'todo' | 'inProgress' | 'done';

export type StickyColor = 'yellow' | 'coral' | 'teal' | 'rose' | 'orange';

export const STICKY_COLORS: StickyColor[] = ['yellow', 'coral', 'teal', 'rose', 'orange'];

export interface Position {
  x: number;
  y: number;
}

export interface Task {
  id: string;
  /** 付箋左上に書く日付 YYYY-MM-DD。カレンダーのグループ化基準。 */
  date: string;
  content: string;
  status: Status;
  color: StickyColor;
  /** 机面上の自由配置座標（机面の左上を基準としたpx）。 */
  position: Position;
  createdAt: number;
  /** 現在「作業中」で計測が走っている場合の、今回セッションの開始時刻。停止中は undefined。 */
  inProgressAt?: number;
  /** 過去に作業中だった分の累積ミリ秒。ToDo/完了に移しても保持され、机に戻すと続きから加算。 */
  accumulatedMs?: number;
  /** ゴミ箱に入れた（完了した）時刻。 */
  doneAt?: number;
}

export type View = 'desk' | 'calendar';
