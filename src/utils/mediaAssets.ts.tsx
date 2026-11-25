const DB_NAME = 'folded_notes_media_db';
const STORE_NAME = 'assets';
const MASCOT_KEY = 'custom_mascot_png';
const VIDEO_KEY = 'custom_intro_video';

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAsset(key: string, value: unknown): Promise<void> {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAsset<T>(key: string): Promise<T | null> {
  try {
    const db = await openMediaDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function deleteAsset(key: string): Promise<void> {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Strips solid white / near-white backgrounds using soft alpha feathering
 * so the mint-green mascot floats cleanly on Pitch Black, Matte Charcoal, and Paper themes.
 */
export function removeWhiteBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const minChannel = Math.min(r, g, b);
          const maxChannel = Math.max(r, g, b);
          const saturation = maxChannel - minChannel;

          // Pure white & very light neutral gray shadow removal with smooth anti-aliased edge
          if (minChannel >= 246 && saturation <= 14) {
            data[i + 3] = 0;
          } else if (minChannel >= 232 && saturation <= 18) {
            const alphaFactor = (246 - minChannel) / 14;
            data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, alphaFactor)));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function saveCustomMascot(file: File): Promise<string> {
  const transparentPng = await removeWhiteBackground(file);
  await putAsset(MASCOT_KEY, transparentPng);
  return transparentPng;
}

export async function loadCustomMascot(): Promise<string | null> {
  return getAsset<string>(MASCOT_KEY);
}

export async function clearCustomMascot(): Promise<void> {
  await deleteAsset(MASCOT_KEY);
}

export async function saveCustomIntroVideo(file: File): Promise<string> {
  await putAsset(VIDEO_KEY, file);
  return URL.createObjectURL(file);
}

export async function loadCustomIntroVideo(): Promise<string | null> {
  const blob = await getAsset<Blob>(VIDEO_KEY);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function clearCustomIntroVideo(): Promise<void> {
  await deleteAsset(VIDEO_KEY);
}