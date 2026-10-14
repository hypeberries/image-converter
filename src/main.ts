import JSZip from 'jszip';
import { icon, type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faArrowRight, faCheck, faChevronDown, faDownload } from '@fortawesome/free-solid-svg-icons';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/inter/wght-italic.css';
import './styles.css';

type Format = 'webp' | 'avif';
type Effort = 'fast' | 'balanced' | 'smallest';
type ResizeMode = 'original' | 'large' | 'medium' | 'small' | 'custom';
type ItemStatus = 'ready' | 'processing' | 'done' | 'error';

interface ConvertedResult {
  blob: Blob;
  url: string;
  name: string;
  width: number;
  height: number;
}

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  error?: string;
  result?: ConvertedResult;
}

interface WorkerResponse {
  id: string;
  buffer?: ArrayBuffer;
  error?: string;
}

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_PIXELS = 60_000_000;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function renderIcon(definition: IconDefinition): string {
  return icon(definition, {
    classes: ['fa-icon'],
    attributes: { 'aria-hidden': 'true' },
  }).html.join('');
}

const state = {
  items: [] as ImageItem[],
  format: 'webp' as Format,
  quality: 90,
  effort: 'balanced' as Effort,
  resizeMode: 'original' as ResizeMode,
  customWidth: '',
  customHeight: '',
  keepAspectRatio: true,
  lossless: false,
  converting: false,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

app.innerHTML = `
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="Hypeberries Image Converter home">
        <img src="/images/logo.png" alt="Hypeberries" width="208" height="52">
      </a>
      <nav aria-label="Page navigation">
        <a href="#guide">Format guide</a>
        <a href="#privacy">Privacy</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <h1 id="page-title">Convert images to WebP or AVIF</h1>
      <p>Private, browser-based conversion. Nothing is uploaded.</p>
    </section>

    <section class="workspace" aria-label="Image converter">
      <div class="panel files-panel">
        <div class="step-heading">
          <span>01</span>
          <div><h2>Add images</h2><p>JPEG, PNG, WebP or AVIF</p></div>
        </div>

        <input id="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden>
        <button id="drop-zone" class="drop-zone" type="button">
          <span class="upload-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"/></svg>
          </span>
          <strong>Drop images here</strong>
          <span class="drop-separator">or</span>
          <span class="choose-button">Choose images</span>
          <small class="drop-limits">JPEG, PNG, WebP or AVIF · 30 MB maximum</small>
        </button>

        <div id="queue-wrap" class="queue-wrap" hidden>
          <div class="queue-header">
            <h3>Queue <span id="queue-count"></span></h3>
            <button id="clear-all" class="text-button" type="button">Clear all</button>
          </div>
          <div id="queue" class="queue" aria-live="polite"></div>
          <button id="add-more" class="secondary-button add-more" type="button">+ Add more images</button>
        </div>
      </div>

      <div class="panel options-panel">
        <div class="step-heading">
          <span>02</span>
          <div><h2>Choose output</h2><p>One setting applies to every image</p></div>
        </div>

        <fieldset class="control-group">
          <legend>Format</legend>
          <div class="format-toggle">
            <label><input type="radio" name="format" value="webp" checked><span>WebP<small>Great all-rounder</small></span></label>
            <label><input type="radio" name="format" value="avif"><span>AVIF<small>Smallest files</small></span></label>
          </div>
        </fieldset>

        <div class="control-group quality-group">
          <div class="control-label-row">
            <label for="quality">Quality</label>
            <output id="quality-output" for="quality">90%</output>
          </div>
          <input id="quality" type="range" min="80" max="100" value="90" step="1">
          <div class="range-labels"><span>Smaller file</span><span>Best quality</span></div>
        </div>

        <details class="advanced-options">
          <summary>
            <span><strong>More options</strong><small>Resize, compression and image handling</small></span>
            <span class="details-chevron" aria-hidden="true">${renderIcon(faChevronDown)}</span>
          </summary>
          <div class="advanced-options-content">
            <div class="control-group two-cols">
              <label>Resize
                <span class="select-wrap">
                  <select id="resize-mode">
                    <option value="original">Original dimensions</option>
                    <option value="large">Max 2560 px</option>
                    <option value="medium">Max 1920 px</option>
                    <option value="small">Max 1280 px</option>
                    <option value="custom">Custom size</option>
                  </select>
                  <span class="select-chevron">${renderIcon(faChevronDown)}</span>
                </span>
              </label>
              <label>Compression
                <span class="select-wrap">
                  <select id="effort">
                    <option value="fast">Fast</option>
                    <option value="balanced" selected>Balanced</option>
                    <option value="smallest">Smallest file</option>
                  </select>
                  <span class="select-chevron">${renderIcon(faChevronDown)}</span>
                </span>
              </label>
            </div>

            <div id="custom-size" class="custom-size" hidden>
              <label>Width <span>px</span><input id="custom-width" type="number" min="1" max="16000" inputmode="numeric" placeholder="Auto"></label>
              <span class="size-cross" aria-hidden="true">×</span>
              <label>Height <span>px</span><input id="custom-height" type="number" min="1" max="16000" inputmode="numeric" placeholder="Auto"></label>
              <label class="check-line">
                <span class="custom-check">
                  <input id="keep-ratio" type="checkbox" checked>
                  <span class="check-box" aria-hidden="true">${renderIcon(faCheck)}</span>
                </span>
                <span>Keep ratio</span>
              </label>
            </div>

            <div class="option-list">
              <label id="lossless-row" class="option-row">
                <span class="option-copy"><strong>Lossless compression</strong><small>Preserve every pixel; the file may be larger</small></span>
                <span class="switch"><input id="lossless" type="checkbox"><i></i></span>
              </label>
              <div class="option-row static-option">
                <span class="option-copy"><strong>Auto-orient</strong><small>Correct rotation using the source metadata</small></span>
                <span class="locked-check" aria-label="Enabled">${renderIcon(faCheck)}</span>
              </div>
              <div class="option-row static-option">
                <span class="option-copy"><strong>Remove metadata</strong><small>Always on for privacy and smaller files</small></span>
                <span class="locked-check" aria-label="Enabled">${renderIcon(faCheck)}</span>
              </div>
            </div>
          </div>
        </details>

        <button id="convert" class="primary-button" type="button" disabled>
          <span>Choose images to start</span><span class="button-icon">${renderIcon(faArrowRight)}</span>
        </button>
        <p class="local-note"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 2.8 8.4 7 10 4.2-1.6 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>Processed locally. Nothing is uploaded.</p>
      </div>
    </section>

    <section id="results-section" class="results-section" hidden aria-labelledby="results-title">
      <div class="results-heading">
        <div class="step-heading">
          <span>03</span>
          <div><h2 id="results-title">Download converted files</h2><p id="results-summary"></p></div>
        </div>
        <button id="download-all" class="primary-button compact" type="button">Download all as ZIP <span class="button-icon">${renderIcon(faDownload)}</span></button>
      </div>
      <div id="results" class="results"></div>
    </section>

    <section id="guide" class="guide" aria-labelledby="guide-title">
      <div class="guide-intro">
        <h2 id="guide-title">Which format should you choose?</h2>
        <p>For most websites, WebP at 90% is a dependable default. Try AVIF when the smallest possible file matters and you can spend a little longer encoding it.</p>
      </div>
      <dl class="format-notes">
        <div><dt>WebP</dt><dd>Fast to create, broadly useful, and a good choice for everyday website images.</dd></div>
        <div><dt>AVIF</dt><dd>Often produces smaller files, especially for photographs, but takes longer to encode.</dd></div>
        <div><dt>Quality</dt><dd>Start at 90%. Lower it when file size matters more; raise it for detailed artwork or text.</dd></div>
      </dl>
    </section>

    <section id="privacy" class="privacy-note" aria-labelledby="privacy-title">
      <div>
        <h2 id="privacy-title">Your images stay on your device.</h2>
      </div>
      <div>
        <p>The converter has no image upload endpoint. Your browser decodes, resizes and encodes each file locally. Like most websites, the host may keep standard request logs, but those requests never contain your image files or conversion settings.</p>
        <a href="mailto:fenda@hypeberries.com?subject=Image%20Converter%20feedback">Send feedback</a>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-inner">
      <div class="footer-brand">
        <img src="/images/logo.png" alt="Hypeberries" width="208" height="52" loading="lazy">
        <p>Free tools made for the web.</p>
      </div>
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="/">Converter</a>
        <a href="#guide">Format guide</a>
        <a href="#privacy">Privacy</a>
        <a href="https://widgets.hypeberries.com/">Widgets</a>
        <a href="https://github.com/hypeberries" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
      <p>Independent tools by Hypeberries.<br>Made for a calmer web.</p>
    </div>
  </footer>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`;

const fileInput = getElement<HTMLInputElement>('file-input');
const dropZone = getElement<HTMLButtonElement>('drop-zone');
const queueWrap = getElement<HTMLDivElement>('queue-wrap');
const queue = getElement<HTMLDivElement>('queue');
const queueCount = getElement<HTMLSpanElement>('queue-count');
const clearAllButton = getElement<HTMLButtonElement>('clear-all');
const addMoreButton = getElement<HTMLButtonElement>('add-more');
const qualityInput = getElement<HTMLInputElement>('quality');
const qualityOutput = getElement<HTMLOutputElement>('quality-output');
const resizeSelect = getElement<HTMLSelectElement>('resize-mode');
const effortSelect = getElement<HTMLSelectElement>('effort');
const customSize = getElement<HTMLDivElement>('custom-size');
const customWidth = getElement<HTMLInputElement>('custom-width');
const customHeight = getElement<HTMLInputElement>('custom-height');
const keepRatio = getElement<HTMLInputElement>('keep-ratio');
const losslessInput = getElement<HTMLInputElement>('lossless');
const losslessRow = getElement<HTMLLabelElement>('lossless-row');
const convertButton = getElement<HTMLButtonElement>('convert');
const resultsSection = getElement<HTMLElement>('results-section');
const results = getElement<HTMLDivElement>('results');
const resultsSummary = getElement<HTMLParagraphElement>('results-summary');
const downloadAllButton = getElement<HTMLButtonElement>('download-all');
const toast = getElement<HTMLDivElement>('toast');

let toastTimer = 0;

dropZone.addEventListener('click', () => fileInput.click());
addMoreButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
  });
}

dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer?.files ?? null));

clearAllButton.addEventListener('click', clearAll);

queue.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
  if (!button || state.converting) return;
  removeItem(button.dataset.remove ?? '');
});

document.querySelectorAll<HTMLInputElement>('input[name="format"]').forEach((input) => {
  input.addEventListener('change', () => {
    state.format = input.value as Format;
    state.lossless = false;
    losslessInput.checked = false;
    qualityInput.disabled = false;
    document.querySelector('.quality-group')?.classList.remove('is-disabled');
    const isWebp = state.format === 'webp';
    losslessInput.disabled = !isWebp;
    losslessRow.classList.toggle('is-disabled', !isWebp);
    losslessRow.querySelector('small')!.textContent = isWebp
      ? 'Preserve every pixel; the file may be larger'
      : 'Lossless mode is available for WebP output';
    invalidateResults();
  });
});

qualityInput.addEventListener('input', () => {
  state.quality = Number(qualityInput.value);
  qualityOutput.textContent = `${state.quality}%`;
  updateQualityTrack();
  invalidateResults();
});

resizeSelect.addEventListener('change', () => {
  state.resizeMode = resizeSelect.value as ResizeMode;
  customSize.hidden = state.resizeMode !== 'custom';
  invalidateResults();
});

effortSelect.addEventListener('change', () => {
  state.effort = effortSelect.value as Effort;
  invalidateResults();
});

customWidth.addEventListener('input', () => {
  state.customWidth = customWidth.value;
  invalidateResults();
});

customHeight.addEventListener('input', () => {
  state.customHeight = customHeight.value;
  invalidateResults();
});

keepRatio.addEventListener('change', () => {
  state.keepAspectRatio = keepRatio.checked;
  invalidateResults();
});

losslessInput.addEventListener('change', () => {
  state.lossless = losslessInput.checked;
  qualityInput.disabled = state.lossless;
  document.querySelector('.quality-group')?.classList.toggle('is-disabled', state.lossless);
  invalidateResults();
});

convertButton.addEventListener('click', convertAll);
downloadAllButton.addEventListener('click', downloadAll);

results.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-download]');
  if (!button) return;
  const item = state.items.find((candidate) => candidate.id === button.dataset.download);
  if (item?.result) downloadBlob(item.result.blob, item.result.name);
});

window.addEventListener('beforeunload', releaseUrls);
updateQualityTrack();

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

function addFiles(fileList: FileList | null): void {
  if (!fileList?.length || state.converting) return;

  let rejected = 0;
  for (const file of Array.from(fileList)) {
    if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      rejected += 1;
      continue;
    }
    state.items.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'ready',
    });
  }

  if (rejected) showToast(`${rejected} file${rejected === 1 ? ' was' : 's were'} skipped. Use JPEG, PNG, WebP or AVIF under 30 MB.`);
  renderQueue();
}

function removeItem(id: string): void {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [item] = state.items.splice(index, 1);
  URL.revokeObjectURL(item.previewUrl);
  if (item.result) URL.revokeObjectURL(item.result.url);
  renderQueue();
  renderResults();
}

function clearAll(): void {
  if (state.converting) return;
  releaseUrls();
  state.items = [];
  renderQueue();
  renderResults();
}

function releaseUrls(): void {
  for (const item of state.items) {
    URL.revokeObjectURL(item.previewUrl);
    if (item.result) URL.revokeObjectURL(item.result.url);
  }
}

function invalidateResults(): void {
  if (!state.items.some((item) => item.result)) return;
  for (const item of state.items) {
    if (item.result) URL.revokeObjectURL(item.result.url);
    item.result = undefined;
    item.error = undefined;
    item.status = 'ready';
  }
  renderQueue();
  renderResults();
}

function renderQueue(): void {
  const count = state.items.length;
  queueWrap.hidden = count === 0;
  dropZone.classList.toggle('compact-drop', count > 0);
  queueCount.textContent = `(${count})`;
  clearAllButton.disabled = state.converting;
  addMoreButton.disabled = state.converting;
  convertButton.disabled = count === 0 || state.converting;
  convertButton.innerHTML = state.converting
    ? '<span class="spinner" aria-hidden="true"></span><span>Converting…</span>'
    : `<span>${count ? `Convert ${count} image${count === 1 ? '' : 's'}` : 'Choose images to start'}</span><span class="button-icon">${renderIcon(faArrowRight)}</span>`;

  queue.innerHTML = state.items.map((item) => `
    <article class="queue-item">
      <img src="${item.previewUrl}" alt="">
      <div class="file-copy">
        <strong title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong>
        <span>${formatBytes(item.file.size)}</span>
        ${statusMarkup(item)}
      </div>
      <button class="remove-button" type="button" data-remove="${item.id}" aria-label="Remove ${escapeHtml(item.file.name)}" ${state.converting ? 'disabled' : ''}>×</button>
    </article>
  `).join('');
}

function statusMarkup(item: ImageItem): string {
  if (item.status === 'processing') return '<span class="status processing">Processing…</span>';
  if (item.status === 'done') return '<span class="status done">Ready</span>';
  if (item.status === 'error') return `<span class="status error">${escapeHtml(item.error ?? 'Could not convert')}</span>`;
  return '<span class="status">Ready to convert</span>';
}

async function convertAll(): Promise<void> {
  if (state.converting || !state.items.length) return;
  if (state.resizeMode === 'custom' && !validCustomSize()) {
    showToast('Enter a valid custom width, height, or both.');
    customWidth.focus();
    return;
  }

  state.converting = true;
  for (const item of state.items) {
    if (item.result) URL.revokeObjectURL(item.result.url);
    item.result = undefined;
    item.error = undefined;
    item.status = 'ready';
  }
  renderQueue();
  renderResults();

  for (const item of state.items) {
    item.status = 'processing';
    renderQueue();
    try {
      item.result = await convertItem(item);
      item.status = 'done';
    } catch (error) {
      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Could not convert this image.';
    }
    renderQueue();
    renderResults();
  }

  state.converting = false;
  renderQueue();
  renderResults();
  const successful = state.items.filter((item) => item.result).length;
  showToast(successful ? `${successful} image${successful === 1 ? '' : 's'} ready to download.` : 'No images could be converted.');
  if (successful) resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function convertItem(item: ImageItem): Promise<ConvertedResult> {
  const bitmap = await createImageBitmap(item.file, { imageOrientation: 'from-image' });
  const dimensions = getOutputDimensions(bitmap.width, bitmap.height);
  if (dimensions.width * dimensions.height > MAX_PIXELS) {
    bitmap.close();
    throw new Error('Output is too large. Resize it below 60 megapixels.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error('Your browser could not prepare the image.');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
  bitmap.close();
  const imageData = context.getImageData(0, 0, dimensions.width, dimensions.height);
  const buffer = await encodeInWorker(imageData);
  const mime = `image/${state.format}`;
  const blob = new Blob([buffer], { type: mime });
  const name = replaceExtension(item.file.name, state.format);
  return {
    blob,
    url: URL.createObjectURL(blob),
    name,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function encodeInWorker(imageData: ImageData): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./converter.worker.ts', import.meta.url), { type: 'module' });
    const id = crypto.randomUUID();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      worker.terminate();
      if (event.data.error || !event.data.buffer) reject(new Error(event.data.error ?? 'Encoder returned no data.'));
      else resolve(event.data.buffer);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'The image encoder failed to start.'));
    };
    worker.postMessage({
      id,
      imageData,
      format: state.format,
      quality: state.quality,
      effort: state.effort,
      lossless: state.lossless,
    }, [imageData.data.buffer]);
  });
}

function getOutputDimensions(sourceWidth: number, sourceHeight: number): { width: number; height: number } {
  const preset = state.resizeMode === 'large' ? 2560 : state.resizeMode === 'medium' ? 1920 : state.resizeMode === 'small' ? 1280 : null;
  if (preset) {
    const scale = Math.min(1, preset / Math.max(sourceWidth, sourceHeight));
    return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)) };
  }
  if (state.resizeMode !== 'custom') return { width: sourceWidth, height: sourceHeight };

  const requestedWidth = clampDimension(Number(state.customWidth)) || null;
  const requestedHeight = clampDimension(Number(state.customHeight)) || null;
  if (requestedWidth && requestedHeight && !state.keepAspectRatio) return { width: requestedWidth, height: requestedHeight };
  if (requestedWidth && requestedHeight) {
    const scale = Math.min(requestedWidth / sourceWidth, requestedHeight / sourceHeight);
    return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)) };
  }
  if (requestedWidth) return { width: requestedWidth, height: Math.max(1, Math.round(sourceHeight * requestedWidth / sourceWidth)) };
  if (requestedHeight) return { width: Math.max(1, Math.round(sourceWidth * requestedHeight / sourceHeight)), height: requestedHeight };
  return { width: sourceWidth, height: sourceHeight };
}

function clampDimension(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 0;
  return Math.min(16000, Math.round(value));
}

function validCustomSize(): boolean {
  return clampDimension(Number(state.customWidth)) > 0 || clampDimension(Number(state.customHeight)) > 0;
}

function renderResults(): void {
  const completed = state.items.filter((item): item is ImageItem & { result: ConvertedResult } => Boolean(item.result));
  resultsSection.hidden = completed.length === 0;
  if (!completed.length) {
    results.innerHTML = '';
    return;
  }

  const originalTotal = completed.reduce((total, item) => total + item.file.size, 0);
  const resultTotal = completed.reduce((total, item) => total + item.result.blob.size, 0);
  const saved = originalTotal > 0 ? Math.round((1 - resultTotal / originalTotal) * 100) : 0;
  resultsSummary.textContent = `${formatBytes(originalTotal)} → ${formatBytes(resultTotal)} · ${saved > 0 ? `${saved}% smaller` : 'conversion complete'}`;
  downloadAllButton.disabled = state.converting;

  results.innerHTML = completed.map((item) => {
    const difference = Math.round((1 - item.result.blob.size / item.file.size) * 100);
    const badge = difference > 0 ? `${difference}% smaller` : `${Math.abs(difference)}% larger`;
    return `
      <article class="result-card">
        <img src="${item.result.url}" alt="Converted preview of ${escapeHtml(item.file.name)}">
        <div class="result-copy">
          <strong title="${escapeHtml(item.result.name)}">${escapeHtml(item.result.name)}</strong>
          <span>${item.result.width} × ${item.result.height}</span>
        </div>
        <div class="size-change">
          <span>${formatBytes(item.file.size)} → <strong>${formatBytes(item.result.blob.size)}</strong></span>
          <small class="${difference > 0 ? 'saving' : 'increase'}">${badge}</small>
        </div>
        <button type="button" class="download-button" data-download="${item.id}">Download <span class="button-icon">${renderIcon(faDownload)}</span></button>
      </article>
    `;
  }).join('');
}

async function downloadAll(): Promise<void> {
  const completed = state.items.filter((item): item is ImageItem & { result: ConvertedResult } => Boolean(item.result));
  if (!completed.length || state.converting) return;
  downloadAllButton.disabled = true;
  downloadAllButton.textContent = 'Preparing ZIP…';
  try {
    const zip = new JSZip();
    const usedNames = new Set<string>();
    for (const item of completed) {
      const uniqueName = makeUniqueName(item.result.name, usedNames);
      zip.file(uniqueName, item.result.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    downloadBlob(blob, `converted-${state.format}-images.zip`);
  } catch {
    showToast('The ZIP could not be created. You can still download each image.');
  } finally {
    downloadAllButton.disabled = false;
    downloadAllButton.innerHTML = `Download all as ZIP <span class="button-icon">${renderIcon(faDownload)}</span>`;
  }
}

function makeUniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const extension = dot >= 0 ? name.slice(dot) : '';
  let counter = 2;
  let candidate = `${base}-${counter}${extension}`;
  while (used.has(candidate)) candidate = `${base}-${++counter}${extension}`;
  used.add(candidate);
  return candidate;
}

function replaceExtension(name: string, extension: Format): string {
  const base = name.replace(/\.[^.]+$/, '') || 'converted-image';
  return `${base}.${extension}`;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[index]}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4200);
}

function updateQualityTrack(): void {
  const position = ((state.quality - 80) / 20) * 100;
  qualityInput.style.setProperty('--quality-position', `${position}%`);
}
