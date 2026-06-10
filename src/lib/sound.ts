/**
 * ほんのり鳴るチャイム（指定周波数を順番に短く鳴らす）。
 * オーディオ不可・自動再生制限などの環境では黙って無視する。
 */
export function playChime(freqs: number[] = [880, 1320], gap = 0.16): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = start + i * gap;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    });
    window.setTimeout(() => ctx.close(), (freqs.length * gap + 0.6) * 1000);
  } catch {
    /* オーディオ不可なら無音で続行 */
  }
}
