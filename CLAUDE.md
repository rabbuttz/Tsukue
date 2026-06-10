# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tsukue (机 = "desk") is a Japanese task manager that turns task tracking into a desk metaphor: sticky notes (付箋) move between a **Tray** (To Do), the **Desk surface** (In Progress, with live time tracking), and the **Trash** (Done). A wall calendar in the corner flips to a month view that scatters notes by date. The codebase and UI are in Japanese — match that when adding comments or user-facing strings.

It is an explicitly labeled **prototype**: data persists to `localStorage` today, but the storage layer is abstracted so it can be swapped for a server API without touching the UI.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b (typecheck/emit) then vite build → dist/
npm run typecheck  # tsc --noEmit, the only "lint" gate
npm run preview    # serve the built dist/
```

There is **no test runner and no ESLint** configured. `npm run typecheck` is the verification step — TypeScript is in `strict` mode with `noUnusedLocals`/`noUnusedParameters`, so unused symbols are build errors.

## Architecture

**Tasks live in `src/state/useTasks.ts`; the desk layout lives in `src/state/useDeskWidgets.ts`.** These are the two stores, and the split is deliberate — tasks (付箋 with a lifecycle) vs. ephemeral desk decoration (widgets + pasted content). `useTasks` owns the entire task array and exposes every task mutation (`moveToTray`/`moveToDesk`/`moveToTrash`, `restoreFromTrash`, `addTask`, `updateContent`/`updateDate`/`updatePosition`, `removeTask`); it auto-persists on change and is passed down as the `store` prop. **Add task operations here, not in a third store.** Both hooks follow the same pattern: own the array, mutate immutably, skip the first-render save, auto-persist via a repo/loader.

**A `Task`'s lifecycle is encoded in `status` + timing fields**, not separate lists. The three desk zones are just filters over `status` (`byStatus`). Key invariants in `useTasks.ts` and `src/lib/elapsed.ts`:
- **Time tracking only runs on the desk.** `inProgressAt` = current session start; `accumulatedMs` = banked time. Moving off the desk calls `pause()`, which folds the running session into `accumulatedMs` and clears `inProgressAt`. Moving back to the desk resumes from the bank. Elapsed time survives To Do/Done round-trips.
- **The "pad" (白紙パッド).** A blank note with `status: 'inProgress'` and `inProgressAt == null` — identified by `isPad()` — sits pinned to the desk's top-right as the "new note" source. An effect always keeps exactly one pad present; grabbing and dropping it commits it as a real task and a fresh pad is refilled. `isPad()` notes are excluded from the calendar and the view-transition animation.

**The desk-objects layer (`useDeskWidgets.ts` + `src/storage/deskLayout.ts`).** Separate from tasks, the desk holds two kinds of free-floating objects, both stored under the single `tsukue.deskLayout.v1` key:
- **Widgets** (`PlacedWidget`) — instances of the fixed `WIDGET_CATALOG` (`pomodoro` / `clock` / `alarm`), each with `(x, y)` and an optional `scale`. The pomodoro is the default-seeded widget. Components: `PomodoroTimer`, `AnalogClock`, `AlarmClock`, wrapped by `DeskWidget`; added via `WidgetPicker`.
- **Content items** (`PlacedItem`) — `text` / `image` / `video` / `url` notes pasted onto the desk, each with `(x, y, w, h)`. Added via `AddMenu`; rendered by `DeskItem`. Images/videos are downscaled and stored as **dataURLs in localStorage** (`src/lib/image.ts`), so large media bloats the key — keep `MEDIA_DEFAULT_MAX` in mind.

`loadDeskLayout()` does **defensive migration**: it coerces/validates every field and upgrades two legacy shapes (a bare `{pomodoro:{x,y}}` and an old `images[]` array → `items[]`). Corrupt or oversized data is swallowed and falls back to defaults — the prototype never throws on bad storage. URL items fetch OGP previews through public CORS proxies in `src/lib/ogp.ts`; **note the target URL is sent to a third-party proxy** (corsproxy.io, falling back to allorigins). Notifications/sound for the timers go through `src/lib/notify.ts` / `src/lib/sound.ts`, both no-ops when unsupported or unpermitted.

**Persistence for tasks is behind `TaskRepository` (`src/storage/`).** `useTasks(repo = localStorageRepo)` takes the repo as a swappable dependency. The interface is just `load()`/`save()`. To move off localStorage, write a new `TaskRepository` implementation — do not reach into `localStorage` from components. (The desk layout is *not* yet behind this interface — it uses the `loadDeskLayout`/`saveDeskLayout` functions directly.)

**Two views, both always mounted (`src/App.tsx`).** `DeskView` and `CalendarView` are rendered simultaneously (one hidden) so the FLIP-style transition can measure both. `navigate()` reads the screen rects of every `[data-task-id]` element in each view and animates clone "fly" elements from source rect to destination rect. **Any element representing a task in either view must carry `data-task-id={t.id}`** or it will be skipped by the animation. The trash bin carries `data-trash` so completed notes can fly in/out of it.

**All dragging is custom pointer-based, not HTML5 DnD.** There are two distinct systems, both deliberate:
- **Sticky notes use `src/hooks/useDeskDrag.ts`** — supports free placement at arbitrary `(x, y)` on the desk *and* zone hit-testing. `begin()` attaches window `pointermove`/`pointerup` listeners; `hitTest()` resolves which zone (trash → tray → desk priority) the pointer is over and computes desk-relative, clamped coordinates on drop. `StickyNote` skips drag initiation when the pointer-down target is a `textarea`/`input`/`button` so editing still works.
- **Desk widgets/items use `useObjectMove.ts` (move) + `useCornerResize.ts` (resize).** These have no zones — just clamped free placement on the desk. `useObjectMove` uses a 5px threshold so a near-stationary press passes through as a click (text editing, links, the play button keep working) and cancels the one spurious trailing click; pass `ignoreSelector` for sub-elements like the ×/resize handle. `useCornerResize` reports raw `(dx, dy)` and leaves the size math (uniform scale for widgets, aspect-locked for media) to the caller.

## Styling

Design tokens in `src/theme/tokens.css` are derived from `DESIGN-miro.md` (a Miro brand/design analysis — the visual reference for this app). Component styles live in `src/styles/components.css` and `global.css`, imported once in `main.tsx`. Sticky-note colors are a fixed palette (`STICKY_COLORS` in `src/types.ts`) cycled by task count.
