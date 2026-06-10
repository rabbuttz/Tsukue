interface Props {
  /** ライブ更新用の現在時刻（ミリ秒）。 */
  now: number;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const pad = (n: number) => String(n).padStart(2, '0');

/** デジタル時計ウィジェット。24時間表示で秒まで（now は1秒刻みで更新される）。 */
export function DigitalClock({ now }: Props) {
  const d = new Date(now);

  return (
    <div className="digiclock">
      <div className="digiclock__time">
        <span className="digiclock__hm">
          {pad(d.getHours())}:{pad(d.getMinutes())}
        </span>
        <span className="digiclock__sec">{pad(d.getSeconds())}</span>
      </div>
      <div className="digiclock__date">
        {d.getMonth() + 1}月{d.getDate()}日（{WEEKDAYS[d.getDay()]}）
      </div>
    </div>
  );
}
