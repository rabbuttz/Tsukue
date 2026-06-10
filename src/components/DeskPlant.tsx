import type { Task } from '../types';

/** 幹・枝のストロークパス。 */
type Stroke = { d: string; w: number; c: string };
/** 葉のかたまり（だ円ブロブ）。rot は度数、中心まわりに回転。 */
type Blob = { cx: number; cy: number; rx: number; ry: number; fill: string; rot?: number };

/** 成長段階。完了数が min 以上なら（より上の段階に達しない限り）この段階になる。 */
type Stage = {
  min: number;
  name: string;
  trunk: Stroke[];
  foliage: Blob[];
  /** 揺れアニメを付けるか（種は揺らさない）。 */
  sway: boolean;
};

const TRUNK = '#8a5a3b'; // 幹の茶
const STEM = '#3f9e5f'; // 若い茎の緑
const G_MID = '#2e9e63'; // 葉・中間の緑
const G_DARK = '#1d7a55'; // 葉・濃い緑
const G_LIGHT = '#5cba83'; // 葉・明るい緑
const FRUIT = '#ff6f61'; // 実（最終段階の差し色）

/** 完了数のしきい値ごとの成長段階（min 昇順）。 */
const STAGES: Stage[] = [
  {
    min: 0,
    name: '種',
    sway: false,
    trunk: [],
    foliage: [
      // 土の上にちょこんと置かれた種
      { cx: 60, cy: 86, rx: 4.5, ry: 5.5, fill: '#9c7349', rot: -12 },
      { cx: 58.4, cy: 84.2, rx: 1.4, ry: 2, fill: '#c9a06f', rot: -12 },
    ],
  },
  {
    min: 1,
    name: '芽',
    sway: true,
    trunk: [{ d: 'M60 92 C60 88 60.5 85 60 81', w: 2.5, c: STEM }],
    foliage: [
      { cx: 54.5, cy: 80, rx: 5.5, ry: 3, fill: G_MID, rot: -28 },
      { cx: 65.5, cy: 78, rx: 5.5, ry: 3, fill: G_LIGHT, rot: 24 },
    ],
  },
  {
    min: 2,
    name: '若木',
    sway: true,
    trunk: [{ d: 'M60 92 C60 84 59 77 60 70', w: 3.5, c: TRUNK }],
    foliage: [
      { cx: 60, cy: 63, rx: 11, ry: 8.5, fill: G_MID },
      { cx: 53.5, cy: 66.5, rx: 6.5, ry: 5, fill: G_DARK },
      { cx: 65, cy: 59.5, rx: 6, ry: 4.5, fill: G_LIGHT },
    ],
  },
  {
    min: 4,
    name: '小さな盆栽',
    sway: true,
    trunk: [
      { d: 'M60 92 C57 81 63 73 59 62', w: 4.5, c: TRUNK },
      { d: 'M59.5 73 C66 70 70 68 74 64', w: 3, c: TRUNK },
    ],
    foliage: [
      { cx: 59, cy: 55, rx: 12, ry: 9, fill: G_MID },
      { cx: 52, cy: 58.5, rx: 7, ry: 5.5, fill: G_DARK },
      { cx: 64.5, cy: 51, rx: 6.5, ry: 5, fill: G_LIGHT },
      { cx: 76, cy: 60.5, rx: 8.5, ry: 6.5, fill: G_MID },
      { cx: 81, cy: 58, rx: 5, ry: 4, fill: G_DARK },
    ],
  },
  {
    min: 7,
    name: '盆栽',
    sway: true,
    trunk: [
      { d: 'M60 92 C55 78 64 70 57 54', w: 5, c: TRUNK },
      { d: 'M58.5 70 C68 66 74 63 79 58', w: 3.5, c: TRUNK },
      { d: 'M59 62 C51 58 46 56 41 52', w: 3, c: TRUNK },
    ],
    foliage: [
      { cx: 56, cy: 46, rx: 13, ry: 9.5, fill: G_MID },
      { cx: 48.5, cy: 50.5, rx: 7.5, ry: 5.5, fill: G_DARK },
      { cx: 62.5, cy: 41.5, rx: 7, ry: 5.5, fill: G_LIGHT },
      { cx: 80.5, cy: 54.5, rx: 9.5, ry: 7, fill: G_MID },
      { cx: 85.5, cy: 51.5, rx: 5, ry: 4, fill: G_DARK },
      { cx: 40.5, cy: 48.5, rx: 8.5, ry: 6.5, fill: G_MID },
      { cx: 35.5, cy: 51.5, rx: 4.5, ry: 3.5, fill: G_LIGHT },
    ],
  },
  {
    min: 10,
    name: '立派な盆栽',
    sway: true,
    trunk: [
      { d: 'M60 92 C53 76 66 66 56 48 C54 44 55 39 58 34', w: 5.5, c: TRUNK },
      { d: 'M57.5 68 C69 63 76 60 83 53', w: 4, c: TRUNK },
      { d: 'M58 58 C48 53 41 50 35 45', w: 3.5, c: TRUNK },
      { d: 'M57 42 C64 39 68 37 73 34', w: 3, c: TRUNK },
    ],
    foliage: [
      { cx: 58, cy: 27, rx: 14, ry: 10, fill: G_MID },
      { cx: 49.5, cy: 31.5, rx: 8.5, ry: 6.5, fill: G_DARK },
      { cx: 66, cy: 23, rx: 7, ry: 5.5, fill: G_LIGHT },
      { cx: 84, cy: 48.5, rx: 11, ry: 8, fill: G_MID },
      { cx: 90, cy: 45, rx: 5.5, ry: 4.5, fill: G_DARK },
      { cx: 34, cy: 40.5, rx: 11, ry: 8, fill: G_MID },
      { cx: 28, cy: 44, rx: 5.5, ry: 4.5, fill: G_LIGHT },
      { cx: 73.5, cy: 30.5, rx: 8.5, ry: 6, fill: G_DARK },
      // 差し色の実
      { cx: 85.5, cy: 52.5, rx: 1.8, ry: 1.8, fill: FRUIT },
      { cx: 31.5, cy: 44.5, rx: 1.8, ry: 1.8, fill: FRUIT },
    ],
  },
];

/** 育つ盆栽ウィジェット。完了タスク数に応じて段階的に育つ（propsからの純粋描画）。 */
export function DeskPlant({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter((t) => t.status === 'done').length;
  // min 昇順なので、満たす最後の段階が現在の段階
  const stage = STAGES.reduce((acc, s) => (done >= s.min ? s : acc));

  return (
    <div className="plant">
      <svg
        className="plant__svg"
        viewBox="0 0 120 120"
        role="img"
        aria-label={`盆栽の成長段階: ${stage.name}（完了 ${done}）`}
      >
        {/* 鉢（テラコッタ）: 胴 → 縁 → 土の順に重ねる */}
        <path d="M41 96 L79 96 L75.5 112.5 Q75 115 72.4 115 H47.6 Q45 115 44.5 112.5 Z" fill="#c4704e" />
        <rect x="35" y="89" width="50" height="8" rx="3" fill="#a85a3e" />
        <ellipse cx="60" cy="89.5" rx="20" ry="3" fill="#5d4631" />
        {/* 幹・枝と葉。葉だけそよ風で揺れる */}
        <g>
          {stage.trunk.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.c}
              strokeWidth={p.w}
              strokeLinecap="round"
            />
          ))}
        </g>
        <g className={stage.sway ? 'plant__foliage plant__foliage--sway' : 'plant__foliage'}>
          {stage.foliage.map((b, i) => (
            <ellipse
              key={i}
              cx={b.cx}
              cy={b.cy}
              rx={b.rx}
              ry={b.ry}
              fill={b.fill}
              transform={b.rot ? `rotate(${b.rot} ${b.cx} ${b.cy})` : undefined}
            />
          ))}
        </g>
      </svg>
      <div className="plant__caption">
        <span className="plant__stage">{stage.name}</span>
        <span className="plant__count">完了 {done}</span>
      </div>
    </div>
  );
}
