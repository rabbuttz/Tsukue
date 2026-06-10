/** Date を YYYY-MM-DD（ローカルタイム）に整形する。 */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** YYYY-MM-DD を「M月D日」表記に。 */
export function formatJpDate(iso: string): string {
  const [, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${Number(m)}月${Number(d)}日`;
}

/** 経過ミリ秒を「○秒前 / ○分前 / ○時間○分 / ○日」へ整形。 */
export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}秒経過`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分経過`;
  const hour = Math.floor(min / 60);
  if (hour < 24) {
    const restMin = min % 60;
    return restMin > 0 ? `${hour}時間${restMin}分経過` : `${hour}時間経過`;
  }
  const day = Math.floor(hour / 24);
  const restHour = hour % 24;
  return restHour > 0 ? `${day}日${restHour}時間経過` : `${day}日経過`;
}
