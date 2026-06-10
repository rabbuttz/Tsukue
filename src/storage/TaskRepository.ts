import type { Task } from '../types';

/**
 * タスクの永続化を抽象化するインターフェース。
 *
 * PROTOTYPE: 現状の実装は localStorage（{@link ./localStorageRepo}）。
 * これはプロトタイプ用の暫定実装であり、将来的にはサーバー API を叩く
 * 実装（例: fetch ベースの HttpTaskRepository）へ差し替える前提。
 * UI 側はこのインターフェースにのみ依存させ、保存先の変更が波及しないようにする。
 */
export interface TaskRepository {
  load(): Task[];
  save(tasks: Task[]): void;
}
