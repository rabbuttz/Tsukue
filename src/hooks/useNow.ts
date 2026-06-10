import { useEffect, useState } from 'react';

/** 一定間隔で現在時刻を返し、経過時間表示などのライブ更新を駆動する。 */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
