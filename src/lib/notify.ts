/**
 * デスクトップ通知のうすいラッパー。
 * 通知非対応・不許可・その他の環境では黙って無視する（音と違って必須ではない）。
 */

/** ブラウザが通知に対応しているか。 */
function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * 通知の許可を求める。ユーザー操作（スタート押下など）の中から呼ぶこと。
 * すでに許可・不許可が確定していれば何もしない。
 */
export function requestNotifyPermission(): void {
  if (!supported()) return;
  try {
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch {
    /* 取得できない環境は無視 */
  }
}

/**
 * デスクトップ通知を表示する。許可されていなければ何もしない。
 * tag を渡すと同種の通知が積み重ならず最新だけが残る。
 */
export function showNotification(title: string, body: string, tag?: string): void {
  if (!supported()) return;
  try {
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, tag });
  } catch {
    /* 表示できない環境は無視 */
  }
}
