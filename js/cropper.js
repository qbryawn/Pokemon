const CARD_RATIO = 63 / 88;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Das Bild konnte nicht gelesen werden."));
    };
    image.src = url;
  });
}

function luminance(data, index) {
  return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
}

function bestBoundary(scores, start, end, fallback) {
  let best = fallback;
  let bestScore = -1;
  for (let i = Math.max(1, start); i < Math.min(scores.length - 1, end); i += 1) {
    const local = scores[i - 1] + scores[i] * 2 + scores[i + 1];
    if (local > bestScore) {
      bestScore = local;
      best = i;
    }
  }
  return best;
}

function detectCardBounds(image) {
  const size = 520;
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight, 1);
  const width = Math.max(80, Math.round(image.naturalWidth * scale));
  const height = Math.max(80, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const xScores = new Float32Array(width);
  const yScores = new Float32Array(height);
  const xStep = Math.max(1, Math.floor(width / 180));
  const yStep = Math.max(1, Math.floor(height / 180));

  for (let y = yStep; y < height; y += yStep) {
    for (let x = xStep; x < width; x += xStep) {
      const index = (y * width + x) * 4;
      const leftIndex = (y * width + x - xStep) * 4;
      const topIndex = ((y - yStep) * width + x) * 4;
      xScores[x] += Math.abs(luminance(data, index) - luminance(data, leftIndex));
      yScores[y] += Math.abs(luminance(data, index) - luminance(data, topIndex));
    }
  }

  const left = bestBoundary(xScores, Math.floor(width * 0.03), Math.floor(width * 0.42), Math.floor(width * 0.08));
  const right = bestBoundary(xScores, Math.floor(width * 0.58), Math.floor(width * 0.97), Math.floor(width * 0.92));
  const top = bestBoundary(yScores, Math.floor(height * 0.03), Math.floor(height * 0.42), Math.floor(height * 0.08));
  const bottom = bestBoundary(yScores, Math.floor(height * 0.58), Math.floor(height * 0.97), Math.floor(height * 0.92));

  let cropWidth = Math.max(width * 0.35, right - left);
  let cropHeight = Math.max(height * 0.45, bottom - top);
  const detectedRatio = cropWidth / cropHeight;
  if (detectedRatio > CARD_RATIO) cropWidth = cropHeight * CARD_RATIO;
  else cropHeight = cropWidth / CARD_RATIO;

  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const x = Math.max(0, Math.min(width - cropWidth, centerX - cropWidth / 2));
  const y = Math.max(0, Math.min(height - cropHeight, centerY - cropHeight / 2));

  return {
    x: x / scale,
    y: y / scale,
    width: cropWidth / scale,
    height: cropHeight / scale,
  };
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Bildexport fehlgeschlagen."))), type, quality);
  });
}

export async function cropCardImage(file) {
  const image = await loadImage(file);
  const bounds = detectCardBounds(image);
  const canvas = document.createElement("canvas");
  canvas.width = 756;
  canvas.height = 1056;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvasToBlob(canvas);
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  if (!dataUrl) return null;
  const response = await fetch(dataUrl);
  return response.blob();
}
