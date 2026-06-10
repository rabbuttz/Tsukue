/**
 * 環境音エンジン。Web Audio API だけでノイズを合成する（外部音源・ネットワーク不使用）。
 * sound.ts と同じ方針で、オーディオ不可・自動再生制限などの環境では黙って何もしない。
 * AudioContext は play() が呼ばれて初めて生成する（ユーザー操作起点・プレビューでは無音）。
 */

export type AmbientKind = 'rain' | 'waves' | 'fire' | 'noise';

export const AMBIENT_PRESETS: { kind: AmbientKind; label: string; icon: string }[] = [
  { kind: 'rain', label: '雨', icon: '🌧️' },
  { kind: 'waves', label: '波', icon: '🌊' },
  { kind: 'fire', label: '焚き火', icon: '🔥' },
  { kind: 'noise', label: 'ノイズ', icon: '🌫️' },
];

type NoiseColor = 'white' | 'pink' | 'brown';

/** 再生中のプリセット一式（出力ゲイン・止めるべきソース・ランダムスケジューラのタイマー）。 */
type Voice = {
  out: GainNode;
  sources: AudioScheduledSourceNode[];
  timers: number[];
};

export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voice: Voice | null = null;
  private volume = 0.5;
  private disposed = false;
  private buffers = new Map<NoiseColor, AudioBuffer>();

  /** 音量 0..1。聴感に合わせて二乗カーブで反映し、ランプでクリックノイズを防ぐ。 */
  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    try {
      if (this.ctx && this.master) {
        this.master.gain.setTargetAtTime(this.volume ** 2, this.ctx.currentTime, 0.05);
      }
    } catch {
      /* オーディオ不可なら無音で続行 */
    }
  }

  /** 指定プリセットを再生する。再生中なら旧プリセットをフェードアウトして切り替える。 */
  play(kind: AmbientKind): void {
    if (this.disposed) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx || !this.master) return;
      void ctx.resume();
      this.stopVoice(0.25);
      this.voice = this.buildVoice(ctx, this.master, kind);
    } catch {
      /* オーディオ不可なら無音で続行 */
    }
  }

  stop(): void {
    try {
      this.stopVoice(0.25);
    } catch {
      /* 無視 */
    }
  }

  /** アンマウント時用。停止して AudioContext ごと閉じる。 */
  dispose(): void {
    this.disposed = true;
    try {
      this.stopVoice(0);
      void this.ctx?.close();
    } catch {
      /* 無視 */
    }
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = this.volume ** 2;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    return ctx;
  }

  /** 現在の Voice をフェードアウトして破棄する。 */
  private stopVoice(fade: number): void {
    const v = this.voice;
    this.voice = null;
    if (!v || !this.ctx) return;
    v.timers.forEach((t) => window.clearTimeout(t));
    const now = this.ctx.currentTime;
    v.out.gain.setTargetAtTime(0.0001, now, Math.max(0.01, fade / 4));
    const stopAt = now + fade + 0.1;
    v.sources.forEach((s) => {
      try {
        s.stop(stopAt);
      } catch {
        /* すでに停止済みなら無視 */
      }
    });
    window.setTimeout(() => {
      try {
        v.out.disconnect();
      } catch {
        /* 無視 */
      }
    }, (fade + 0.2) * 1000);
  }

  /** 2秒ループのノイズバッファ（色ごとにキャッシュ）。 */
  private noiseBuffer(ctx: AudioContext, color: NoiseColor): AudioBuffer {
    const cached = this.buffers.get(color);
    if (cached) return cached;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (color === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } else if (color === 'pink') {
      // Paul Kellet のフィルタ近似によるピンクノイズ
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      // 積分（リーキー）によるブラウンノイズ
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    this.buffers.set(color, buf);
    return buf;
  }

  private loopNoise(ctx: AudioContext, color: NoiseColor): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, color);
    src.loop = true;
    src.start();
    return src;
  }

  /** プリセットごとのオーディオグラフを組み立てる。 */
  private buildVoice(ctx: AudioContext, master: GainNode, kind: AmbientKind): Voice {
    const out = ctx.createGain();
    const now = ctx.currentTime;
    // フェードインしてクリックノイズを防ぐ
    out.gain.setValueAtTime(0.0001, now);
    out.gain.setTargetAtTime(1, now, 0.35);
    out.connect(master);

    const sources: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];

    if (kind === 'rain') {
      // 本体: ピンクノイズ + ローパスでざあざあという雨足
      const body = this.loopNoise(ctx, 'pink');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      lp.Q.value = 0.7;
      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.5;
      body.connect(lp).connect(bodyGain).connect(out);
      sources.push(body);
      // 表面のしぶき: ホワイトノイズの高域をうっすら重ねる
      const hiss = this.loopNoise(ctx, 'white');
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.04;
      hiss.connect(hp).connect(hissGain).connect(out);
      sources.push(hiss);
      // 雨粒: ランダム間隔でピッチの落ちる短いサイン波
      const drop = () => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        const f = 900 + Math.random() * 1800;
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.05);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.04 + Math.random() * 0.04, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        osc.connect(g).connect(out);
        osc.start(t);
        osc.stop(t + 0.09);
        timers[0] = window.setTimeout(drop, 150 + Math.random() * 600);
      };
      timers[0] = window.setTimeout(drop, 300);
    } else if (kind === 'waves') {
      // ブラウンノイズをゆっくりした LFO で揺らして寄せては返す波に
      const noise = this.loopNoise(ctx, 'brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 480;
      const swell = ctx.createGain();
      swell.gain.value = 0.55;
      noise.connect(lp).connect(swell).connect(out);
      sources.push(noise);
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07; // 約14秒周期
      const ampDepth = ctx.createGain();
      ampDepth.gain.value = 0.35;
      lfo.connect(ampDepth).connect(swell.gain);
      // フィルタも一緒に揺らして「ざざーん」という質感を出す
      const filtDepth = ctx.createGain();
      filtDepth.gain.value = 260;
      lfo.connect(filtDepth).connect(lp.frequency);
      lfo.start();
      sources.push(lfo);
    } else if (kind === 'fire') {
      // 低域のごうごうという火の芯
      const base = this.loopNoise(ctx, 'brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      const baseGain = ctx.createGain();
      baseGain.gain.value = 0.4;
      base.connect(lp).connect(baseGain).connect(out);
      sources.push(base);
      // 薪のはぜ: ランダム間隔の短いノイズバースト（バンドパス通し）
      const crackle = () => {
        const t = ctx.currentTime;
        const burst = ctx.createBufferSource();
        burst.buffer = this.noiseBuffer(ctx, 'white');
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200 + Math.random() * 3300;
        bp.Q.value = 1.2;
        const g = ctx.createGain();
        const peak = 0.05 + Math.random() * 0.12;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
        burst.connect(bp).connect(g).connect(out);
        burst.start(t, Math.random() * 1.5, 0.09);
        timers[0] = window.setTimeout(crackle, 60 + Math.random() * 380);
      };
      timers[0] = window.setTimeout(crackle, 200);
    } else {
      // ホワイトノイズ（高域を少し丸めて耳あたりよく）
      const noise = this.loopNoise(ctx, 'white');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 9000;
      const g = ctx.createGain();
      g.gain.value = 0.16;
      noise.connect(lp).connect(g).connect(out);
      sources.push(noise);
    }

    return { out, sources, timers };
  }
}
