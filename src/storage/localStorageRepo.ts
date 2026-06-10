import type { Task } from '../types';
import type { TaskRepository } from './TaskRepository';

// PROTOTYPE: localStorage を使った暫定実装。将来はサーバー API 実装へ差し替える。
const STORAGE_KEY = 'tsukue.tasks.v1';

export const localStorageRepo: TaskRepository = {
  load(): Task[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as Task[];
    } catch {
      // 壊れたデータは無視して空から始める（プロトタイプ方針）。
      return [];
    }
  },

  save(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // 容量超過などは握りつぶす（プロトタイプ方針）。
    }
  },
};
