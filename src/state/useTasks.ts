import { useCallback, useEffect, useRef, useState } from 'react';
import type { Position, StickyColor, StickyFontSize, Status, Task } from '../types';
import { STICKY_COLORS } from '../types';
import { localStorageRepo } from '../storage/localStorageRepo';
import type { TaskRepository } from '../storage/TaskRepository';
import { todayISO } from '../lib/date';

function makeId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickColor(existing: Task[]): StickyColor {
  // 直近の色と被りにくいよう、件数で循環させる。
  return STICKY_COLORS[existing.length % STICKY_COLORS.length];
}

/**
 * 「白紙パッド」= 机の右上に常駐する、まだ着手していない作業中付箋。
 * status:'inProgress' かつ inProgressAt 未設定（タイマー未開始）で表す。
 * つかんで動かす（= moveToDesk/Tray/Trash）と着手扱いになり、新しいパッドが補充される。
 */
export function isPad(t: Task): boolean {
  return t.status === 'inProgress' && t.inProgressAt == null;
}

function makePad(existing: Task[]): Task {
  return {
    id: makeId(),
    date: todayISO(),
    content: '',
    status: 'inProgress',
    color: pickColor(existing),
    position: { x: 0, y: 0 }, // 表示は CSS で右上に固定（この座標は使わない）
    createdAt: Date.now(),
    inProgressAt: undefined,
    accumulatedMs: 0,
  };
}

/** 走っている計測を accumulatedMs に畳み込み、停止状態にする。 */
function pause(t: Task): Pick<Task, 'accumulatedMs' | 'inProgressAt'> {
  const running = t.status === 'inProgress' && t.inProgressAt != null ? Date.now() - t.inProgressAt : 0;
  return { accumulatedMs: (t.accumulatedMs ?? 0) + running, inProgressAt: undefined };
}

export function useTasks(repo: TaskRepository = localStorageRepo) {
  const [tasks, setTasks] = useState<Task[]>(() => repo.load());

  // 初回ロードをスキップして以降の変更だけ保存する。
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    repo.save(tasks);
  }, [tasks, repo]);

  // 机の右上には常に白紙パッドを1枚保つ（使われたら補充）。
  useEffect(() => {
    if (!tasks.some(isPad)) {
      setTasks((prev) => (prev.some(isPad) ? prev : [...prev, makePad(prev)]));
    }
  }, [tasks]);

  const update = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const addTask = useCallback((initial?: Partial<Pick<Task, 'content' | 'date' | 'color'>>) => {
    setTasks((prev) => {
      const task: Task = {
        id: makeId(),
        date: initial?.date ?? todayISO(),
        content: initial?.content ?? '',
        status: 'todo',
        color: initial?.color ?? pickColor(prev),
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        accumulatedMs: 0,
      };
      return [...prev, task];
    });
  }, []);

  const updateContent = useCallback(
    (id: string, content: string) => update(id, { content }),
    [update],
  );

  const updateDate = useCallback(
    (id: string, date: string) => update(id, { date }),
    [update],
  );

  const updateColor = useCallback(
    (id: string, color: StickyColor) => update(id, { color }),
    [update],
  );

  const updateFontSize = useCallback(
    (id: string, fontSize: StickyFontSize) => update(id, { fontSize }),
    [update],
  );

  const moveToTray = useCallback(
    (id: string) => {
      // 計測を一時停止して累積に畳み込む（経過時間は保持）。
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'todo', doneAt: undefined, ...pause(t) } : t)),
      );
    },
    [],
  );

  const moveToDesk = useCallback(
    (id: string, position: Position) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          // 既に計測中（机内の移動）なら維持。停止中なら続きから再開。
          const running = t.status === 'inProgress' && t.inProgressAt != null;
          const inProgressAt = running ? t.inProgressAt : Date.now();
          return { ...t, status: 'inProgress', position, inProgressAt, doneAt: undefined };
        }),
      );
    },
    [],
  );

  const updatePosition = useCallback(
    (id: string, position: Position) => update(id, { position }),
    [update],
  );

  const moveToTrash = useCallback(
    (id: string) => {
      // 完了時も計測を畳み込んで保持（合計時間として残す）。
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: 'done', doneAt: Date.now(), ...pause(t) } : t,
        ),
      );
    },
    [],
  );

  const restoreFromTrash = useCallback(
    (id: string) => update(id, { status: 'todo', doneAt: undefined, inProgressAt: undefined }),
    [update],
  );

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const byStatus = useCallback(
    (status: Status) => tasks.filter((t) => t.status === status),
    [tasks],
  );

  return {
    tasks,
    addTask,
    updateContent,
    updateDate,
    updateColor,
    updateFontSize,
    moveToTray,
    moveToDesk,
    updatePosition,
    moveToTrash,
    restoreFromTrash,
    removeTask,
    byStatus,
  };
}

export type UseTasks = ReturnType<typeof useTasks>;
