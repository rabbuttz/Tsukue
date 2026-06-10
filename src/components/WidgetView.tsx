import type { WidgetKind } from '../storage/deskLayout';
import { PomodoroTimer } from './PomodoroTimer';
import { AnalogClock } from './AnalogClock';
import { DigitalClock } from './DigitalClock';
import { AlarmClock } from './AlarmClock';

/** kind から実ウィジェットの中身を出し分ける（本体・選択プレビュー・ドラッグ中クローンで共用）。 */
export function WidgetView({ kind, now }: { kind: WidgetKind; now: number }) {
  switch (kind) {
    case 'pomodoro':
      return <PomodoroTimer />;
    case 'alarm':
      return <AlarmClock now={now} />;
    case 'digitalClock':
      return <DigitalClock now={now} />;
    default:
      return <AnalogClock now={now} />;
  }
}
