interface Props {
  /** ライブ更新用の現在時刻（ミリ秒）。 */
  now: number;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** かわいいアナログ時計ウィジェット。針の角度は now から算出する（秒針は1秒刻み）。 */
export function AnalogClock({ now }: Props) {
  const d = new Date(now);
  const sec = d.getSeconds();
  const min = d.getMinutes();
  const hour = d.getHours();

  // 12時方向を 0° とした時計回りの角度（SVG は y 下向きなので正回転＝時計回り）。
  const secAngle = sec * 6;
  const minAngle = min * 6 + sec * 0.1;
  const hourAngle = (hour % 12) * 30 + min * 0.5;

  return (
    <div className="clock">
      <svg className="clock__face" viewBox="0 0 120 120" aria-hidden>
        <circle className="clock__bg" cx="60" cy="60" r="57" />
        <circle className="clock__rim" cx="60" cy="60" r="57" />

        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={i}
            className={`clock__tick${i % 3 === 0 ? ' clock__tick--major' : ''}`}
            x1="60"
            y1="9"
            x2="60"
            y2={i % 3 === 0 ? 16 : 13}
            transform={`rotate(${i * 30} 60 60)`}
          />
        ))}

        <line
          className="clock__hand clock__hand--hour"
          x1="60"
          y1="60"
          x2="60"
          y2="38"
          transform={`rotate(${hourAngle} 60 60)`}
        />
        <line
          className="clock__hand clock__hand--min"
          x1="60"
          y1="60"
          x2="60"
          y2="26"
          transform={`rotate(${minAngle} 60 60)`}
        />
        <line
          className="clock__hand clock__hand--sec"
          x1="60"
          y1="64"
          x2="60"
          y2="20"
          transform={`rotate(${secAngle} 60 60)`}
        />
        <circle className="clock__pin" cx="60" cy="60" r="3.5" />
      </svg>

      <div className="clock__date">
        {d.getMonth() + 1}月{d.getDate()}日（{WEEKDAYS[d.getDay()]}）
      </div>
    </div>
  );
}
