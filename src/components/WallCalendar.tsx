interface Props {
  monthLabel: string;
  clockLabel: string;
  dateLabel: string;
  onClick: () => void;
}

/** 画面上部の壁からはみ出して見えるカレンダー。クリックでカレンダー表示へ。 */
export function WallCalendar({ monthLabel, clockLabel, dateLabel, onClick }: Props) {
  return (
    <button className="wall-cal" onClick={onClick} title="カレンダーを開く">
      <span className="wall-cal__binding" aria-hidden />
      <span className="wall-cal__sheet">
        <span className="wall-cal__month">{monthLabel}</span>
        <span className="wall-cal__clock">{clockLabel}</span>
        <span className="wall-cal__date">{dateLabel}</span>
        <span className="wall-cal__hint">クリックでカレンダー表示 ▾</span>
      </span>
    </button>
  );
}
