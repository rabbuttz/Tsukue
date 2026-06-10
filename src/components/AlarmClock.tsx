import { useAlarm } from '../hooks/useAlarm';

interface Props {
  /** ライブ更新用の現在時刻（ミリ秒）。発火判定に使う。 */
  now: number;
}

/** かわいいアラームウィジェット。時刻をセットすると、その時刻に鳴ってお知らせする。 */
export function AlarmClock({ now }: Props) {
  const alarm = useAlarm(now);

  return (
    <div
      className={`alarm${alarm.ringing ? ' alarm--ringing' : ''}${
        alarm.enabled && !alarm.ringing ? ' alarm--armed' : ''
      }`}
    >
      <div className="alarm__phase">
        <span className="alarm__face">{alarm.ringing ? '🔔' : '⏰'}</span>
        アラーム
      </div>

      <input
        className="alarm__time"
        type="time"
        value={alarm.time}
        onChange={(e) => alarm.setTime(e.target.value)}
        disabled={alarm.ringing}
        aria-label="アラーム時刻"
      />

      {alarm.ringing ? (
        <button className="alarm__stop" onClick={alarm.stop}>
          ⏹ 止める
        </button>
      ) : (
        <button
          className={`alarm__switch${alarm.enabled ? ' alarm__switch--on' : ''}`}
          onClick={alarm.toggle}
          role="switch"
          aria-checked={alarm.enabled}
          aria-label="アラームのオン・オフ"
        >
          <span className="alarm__track">
            <span className="alarm__knob" />
          </span>
          <span className="alarm__label">{alarm.enabled ? 'ON' : 'OFF'}</span>
        </button>
      )}

      <div className="alarm__status">
        {alarm.ringing
          ? '時間です！'
          : alarm.enabled
            ? `${alarm.time} に鳴ります`
            : '時刻をセットしてね'}
      </div>
    </div>
  );
}
