import { useEffect, useRef, useState } from 'react';
import { AMBIENT_PRESETS, AmbientEngine, type AmbientKind } from '../lib/ambient';

/**
 * 環境音プレーヤー。雨・波・焚き火・ノイズを Web Audio API で合成して流す。
 * 音はユーザーが再生ボタンを押して初めて鳴る（ピッカーのプレビューでは無音のまま）。
 * 複数マウントされても各インスタンスが自前のエンジンを持ち、アンマウントで閉じる。
 */
export function AmbientPlayer() {
  const engineRef = useRef<AmbientEngine | null>(null);
  const [kind, setKind] = useState<AmbientKind>('rain');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);

  // エンジンは遅延生成（AudioContext 自体は play() まで作られない）
  const engine = () => (engineRef.current ??= new AmbientEngine());

  // アンマウント時に停止して AudioContext を閉じる
  useEffect(() => () => engineRef.current?.dispose(), []);

  const toggle = () => {
    if (playing) {
      engine().stop();
      setPlaying(false);
    } else {
      engine().setVolume(volume);
      engine().play(kind);
      setPlaying(true);
    }
  };

  const pick = (k: AmbientKind) => {
    setKind(k);
    if (playing) engine().play(k); // 再生中ならその場で切り替え
  };

  const onVolume = (v: number) => {
    setVolume(v);
    engine().setVolume(v); // GainNode 経由でライブ反映
  };

  return (
    <div className={`ambient${playing ? ' ambient--playing' : ''}`}>
      <div className="ambient__head">
        <span className="ambient__face">📻</span>
        <span>環境音</span>
      </div>
      <div className="ambient__presets">
        {AMBIENT_PRESETS.map((p) => (
          <button
            key={p.kind}
            type="button"
            className={`ambient__preset${p.kind === kind ? ' ambient__preset--active' : ''}`}
            onClick={() => pick(p.kind)}
            aria-pressed={p.kind === kind}
          >
            <span className="ambient__preset-icon">{p.icon}</span>
            <span className="ambient__preset-label">{p.label}</span>
          </button>
        ))}
      </div>
      <div className="ambient__controls">
        <button
          type="button"
          className="ambient__toggle"
          onClick={toggle}
          aria-label={playing ? '停止' : '再生'}
          title={playing ? '停止' : '再生'}
        >
          {playing ? '⏹' : '▶'}
        </button>
        <span className="ambient__vol-icon" aria-hidden="true">
          🔉
        </span>
        <input
          type="range"
          className="ambient__vol"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          aria-label="音量"
        />
      </div>
    </div>
  );
}
