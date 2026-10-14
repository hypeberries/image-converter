import { encode as encodeAvif } from '@jsquash/avif';
import { encode as encodeWebp } from '@jsquash/webp';

type Format = 'webp' | 'avif';
type Effort = 'fast' | 'balanced' | 'smallest';

interface ConvertMessage {
  id: string;
  imageData: ImageData;
  format: Format;
  quality: number;
  effort: Effort;
  lossless: boolean;
}

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent<ConvertMessage>) => {
  const { id, imageData, format, quality, effort, lossless } = event.data;

  try {
    let buffer: ArrayBuffer;

    if (format === 'webp') {
      const method = effort === 'fast' ? 2 : effort === 'smallest' ? 6 : 4;
      buffer = await encodeWebp(imageData, {
        quality,
        method,
        lossless: lossless ? 1 : 0,
      });
    } else {
      const speed = effort === 'fast' ? 8 : effort === 'smallest' ? 3 : 6;
      buffer = await encodeAvif(imageData, {
        quality,
        qualityAlpha: quality,
        speed,
      });
    }

    worker.postMessage({ id, buffer }, [buffer]);
  } catch (error) {
    worker.postMessage({
      id,
      error: error instanceof Error ? error.message : 'The encoder could not process this image.',
    });
  }
};

export {};
