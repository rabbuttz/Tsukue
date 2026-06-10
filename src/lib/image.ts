// 画像ファイルを机に貼るための読み込みユーティリティ。
// プロトタイプでは dataURL を localStorage に保存するため、長辺を上限まで
// 縮小して容量を抑える（元画像が巨大でも机ではそこまで大きく使わない想定）。

export interface LoadedImage {
  /** 縮小後の dataURL。 */
  src: string;
  /** 縮小後の自然サイズ（px）。表示の初期サイズ・縦横比の基準。 */
  w: number;
  h: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error('読み込みに失敗しました'));
    fr.readAsDataURL(file);
  });
}

function decode(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像をデコードできませんでした'));
    img.src = dataUrl;
  });
}

/** 画像ファイルを読み込み、長辺 max px までダウンスケールして dataURL と寸法を返す。 */
export async function loadImageFile(file: File, max = 1000): Promise<LoadedImage> {
  const original = await readAsDataUrl(file);
  const img = await decode(original);
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;

  const ratio = Math.min(1, max / Math.max(nw, nh));
  if (ratio >= 1) return { src: original, w: nw, h: nh };

  const w = Math.max(1, Math.round(nw * ratio));
  const h = Math.max(1, Math.round(nh * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { src: original, w: nw, h: nh };
  ctx.drawImage(img, 0, 0, w, h);
  // PNG は透過を保つために PNG のまま、それ以外は JPEG で容量優先。
  const out =
    file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  return { src: out, w, h };
}

/**
 * 動画ファイルを読み込み、dataURL と自然サイズ（メタデータから）を返す。
 * 動画は再エンコードできないため dataURL のまま保持する（大きいと localStorage 容量超過で
 * 保存はスキップされる＝プロトタイプ方針）。
 */
export async function loadVideoFile(file: File): Promise<LoadedImage> {
  const src = await readAsDataUrl(file);
  const size = await new Promise<{ w: number; h: number }>((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve({ w: v.videoWidth || 320, h: v.videoHeight || 240 });
    v.onerror = () => resolve({ w: 320, h: 240 });
    v.src = src;
  });
  return { src, w: size.w, h: size.h };
}
