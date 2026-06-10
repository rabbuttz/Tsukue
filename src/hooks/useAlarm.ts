import { useCallback, useEffect, useRef, useState } from 'react';
import { playChime } from '../lib/sound';
import { requestNotifyPermission, showNotification } from '../lib/notify';

export interface Alarm {
  /** 設定時刻 "HH:MM"。 */
  time: string;
  /** セット中（次の該当時刻で鳴る）か。 */
  enabled: boolean;
  /** いま鳴動中か。 */
  ringing: boolean;
  /** 鳴る予定の時刻（セット中のみ）。 */
  armedAt: number | null;
  setTime: (t: string) => void;
  toggle: () => void;
  stop: () => void;
}

/** ts を "HH:MM" に整形。 */
function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "HH:MM" の次の到来時刻（今より後）の timestamp。 */
function nextOccurrence(base: number, time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  let t = d.getTime();
  if (t <= base) t += 24 * 60 * 60 * 1000; // 過ぎていれば翌日。
  return t;
}

/** 鳴りっぱなし防止：この時間で自動停止。 */
const MAX_RING_MS = 40 * 1000;

/**
 * アラームの状態。tick（now）を受け取り、セット時刻に達したら鳴り始める。
 * タイマー同様、配置とは別の一時状態で永続化しない。
 */
export function useAlarm(now: number): Alarm {
  const [time, setTimeState] = useState<string>(() => hhmm(now + 5 * 60 * 1000));
  const [enabled, setEnabled] = useState(false);
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const [ringing, setRinging] = useState(false);
  const ringStartRef = useRef<number | null>(null);

  // 発火判定：セット中で時刻に達したら鳴り始める。
  useEffect(() => {
    if (!enabled || ringing || armedAt == null) return;
    if (now >= armedAt) {
      ringStartRef.current = now;
      setRinging(true);
      showNotification('⏰ アラーム', `${time} になりました。時間です！`, 'tsukue-alarm');
    }
  }, [now, enabled, ringing, armedAt, time]);

  // 鳴動中：一定間隔でチャイムを鳴らす。
  useEffect(() => {
    if (!ringing) return;
    playChime([988, 1319, 988]);
    const id = window.setInterval(() => playChime([988, 1319, 988]), 1600);
    return () => window.clearInterval(id);
  }, [ringing]);

  // 鳴動が長引いたら自動停止。
  useEffect(() => {
    if (!ringing) return;
    if (now - (ringStartRef.current ?? now) >= MAX_RING_MS) {
      setRinging(false);
      setEnabled(false);
      setArmedAt(null);
    }
  }, [now, ringing]);

  const setTime = useCallback((t: string) => {
    setTimeState(t);
    // セット中に時刻を変えたら鳴る予定も追従させる。
    setArmedAt((prev) => (prev != null ? nextOccurrence(Date.now(), t) : prev));
  }, []);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      if (on) {
        setArmedAt(null);
        setRinging(false);
        return false;
      }
      // ON にする（ユーザー操作）タイミングで通知許可を求めておく。
      requestNotifyPermission();
      setArmedAt(nextOccurrence(Date.now(), time));
      return true;
    });
  }, [time]);

  const stop = useCallback(() => {
    setRinging(false);
    setEnabled(false);
    setArmedAt(null);
  }, []);

  return { time, enabled, ringing, armedAt, setTime, toggle, stop };
}
