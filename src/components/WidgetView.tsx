import type { WidgetKind } from '../storage/deskLayout';
import type { Task } from '../types';
import { PomodoroTimer } from './PomodoroTimer';
import { AnalogClock } from './AnalogClock';
import { DigitalClock } from './DigitalClock';
import { AlarmClock } from './AlarmClock';
import { AmbientPlayer } from './AmbientPlayer';
import { FocusMeter } from './FocusMeter';
import { DeskPlant } from './DeskPlant';

/** kind から実ウィジェットの中身を出し分ける（本体・選択プレビュー・ドラッグ中クローンで共用）。 */
export function WidgetView({
  kind,
  now,
  tasks = [],
}: {
  kind: WidgetKind;
  now: number;
  /** タスク連動ウィジェット（集中時間メーター・盆栽）用の全タスク。 */
  tasks?: Task[];
}) {
  switch (kind) {
    case 'pomodoro':
      return <PomodoroTimer />;
    case 'alarm':
      return <AlarmClock now={now} />;
    case 'digitalClock':
      return <DigitalClock now={now} />;
    case 'ambient':
      return <AmbientPlayer />;
    case 'focusMeter':
      return <FocusMeter tasks={tasks} now={now} />;
    case 'plant':
      return <DeskPlant tasks={tasks} />;
    default:
      return <AnalogClock now={now} />;
  }
}
