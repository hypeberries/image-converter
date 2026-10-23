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
  sourceWidth: number;
  sourceHeight: number;
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

interface PageConfig {
  title: string;
  description: string;
  canonical: string;
  heroTitle: string;
  heroDescription: string;
  contextTitle: string;
  contextParagraphs: string[];
  output: Format;
}

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_PIXELS = 60_000_000;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const pageConfig = getPageConfig(window.location.pathname);

function renderIcon(definition: IconDefinition): string {
  return icon(definition, {
    classes: ['fa-icon'],
    attributes: { 'aria-hidden': 'true' },
  }).html.join('');
}

const state = {
  items: [] as ImageItem[],
  format: pageConfig.output,
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
      <div class="site-identity">
        <a class="brand" href="https://hypeberries.com/" aria-label="Hypeberries">
          <img src="/images/logo.png" alt="" width="208" height="52">
        </a>
        <span class="brand-separator" aria-hidden="true">/</span>
        <a class="product-name" href="/">Image Converter</a>
      </div>
      <nav aria-label="Page navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#guide">Format guide</a>
        <a href="/wordpress-image-optimization/">WordPress plugin</a>
        <a href="#privacy">Privacy</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <h1 id="page-title">${pageConfig.heroTitle}</h1>
      <p>${pageConfig.heroDescription}</p>
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
            <label><input type="radio" name="format" value="webp" ${pageConfig.output === 'webp' ? 'checked' : ''}><span>WebP<small>Great all-rounder</small></span></label>
            <label><input type="radio" name="format" value="avif" ${pageConfig.output === 'avif' ? 'checked' : ''}><span>AVIF<small>Smallest files</small></span></label>
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

    <section id="how-it-works" class="how-it-works" aria-labelledby="how-title">
      <div class="section-intro">
        <h2 id="how-title">Three steps, no upload queue.</h2>
        <p>The converter runs locally in your browser. There is no account, server upload, or waiting for a remote job to finish.</p>
      </div>
      <ol class="how-steps">
        <li><span>01</span><div><strong>Choose your images</strong><p>Add one file or a batch of JPEG, PNG, WebP, or AVIF images up to 30 MB each.</p></div></li>
        <li><span>02</span><div><strong>Set the output</strong><p>Choose WebP or AVIF, adjust quality, and open More options when you need resizing or lossless WebP.</p></div></li>
        <li><span>03</span><div><strong>Download the result</strong><p>Save images individually or download the completed batch together as a ZIP file.</p></div></li>
      </ol>
    </section>

    <section class="conversion-context" aria-labelledby="conversion-context-title">
      <div>
        <h2 id="conversion-context-title">${pageConfig.contextTitle}</h2>
      </div>
      <div class="conversion-copy">
        ${pageConfig.contextParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}
      </div>
    </section>

    <section class="benefits" aria-label="Converter features">
      <article><h3>Local by design</h3><p>Your files remain on your device. The browser handles decoding, resizing, and encoding.</p></article>
      <article><h3>Batch friendly</h3><p>Process several images with the same settings and collect the finished files in one ZIP.</p></article>
      <article><h3>Useful controls</h3><p>Balance quality and file size, resize proportionally, or use lossless WebP for pixel-perfect output.</p></article>
    </section>

    <aside class="wordpress-promo" aria-labelledby="wordpress-promo-title">
      <div>
        <span>For WordPress</span>
        <h2 id="wordpress-promo-title">Convert new uploads automatically.</h2>
      </div>
      <div>
        <p>hpb Image Optimization creates WebP or AVIF versions on your own server—without an API, account, quota, or cloud processing.</p>
        <a href="/wordpress-image-optimization/">Explore the WordPress plugin <span aria-hidden="true">→</span></a>
      </div>
    </aside>

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

    <section class="faq" aria-labelledby="faq-title">
      <div class="section-intro">
        <h2 id="faq-title">Image conversion questions</h2>
        <p>Practical answers about quality, privacy, supported files, and browser-based conversion.</p>
      </div>
      <div class="faq-list">
        <details><summary>Do my images leave my device?</summary><p>No. The image data is decoded and converted inside your browser. The website has no image upload endpoint.</p></details>
        <details><summary>Which image formats can I convert?</summary><p>You can add JPEG, PNG, WebP, and AVIF files and export them as WebP or AVIF. Each source image can be up to 30 MB.</p></details>
        <details><summary>Should I choose WebP or AVIF?</summary><p>WebP is a dependable default with fast encoding and broad support. AVIF often creates smaller files, especially for photographs, but takes longer to encode.</p></details>
        <details><summary>What quality setting should I use?</summary><p>Start at 90% for general website use. Lower it when file size matters more, or raise it for screenshots, text, and detailed artwork.</p></details>
        <details><summary>Will transparent backgrounds be preserved?</summary><p>Yes. WebP and AVIF both support transparency, so transparent areas in PNG, WebP, or AVIF source files can remain transparent.</p></details>
        <details><summary>What happens to EXIF and location metadata?</summary><p>The converter applies the source orientation and creates a new output without copying EXIF, location data, comments, or other source metadata.</p></details>
      </div>
    </section>

    <section class="popular-conversions" aria-labelledby="popular-title">
      <h2 id="popular-title">Popular image conversions</h2>
      <nav aria-label="Popular image conversions">
        <a href="/png-to-webp/">PNG to WebP</a>
        <a href="/jpg-to-webp/">JPG to WebP</a>
        <a href="/png-to-avif/">PNG to AVIF</a>
        <a href="/jpg-to-avif/">JPG to AVIF</a>
      </nav>
    </section>
  </main>

  <footer>
    <div class="footer-inner">
      <div class="footer-brand">
        <img src="/images/logo.png" alt="" width="208" height="52" loading="lazy">
        <p>Image Converter is a Hypeberries tool.<br><span>Small tools, built to be useful.</span></p>
      </div>
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="/">Converter</a>
        <a href="/wordpress-image-optimization/">WordPress plugin</a>
        <a href="/privacy/">Privacy</a>
        <a href="https://github.com/hypeberries">GitHub</a>
        <a href="https://hypeberries.com/tools/">All Hypeberries tools</a>
      </nav>
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

applyPageMetadata(pageConfig);
if (window.location.hash) {
  window.addEventListener('load', () => {
    document.querySelector(window.location.hash)?.scrollIntoView({ block: 'start' });
  }, { once: true });
}

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
    setFormat(input.value as Format);
  });
});

setFormat(pageConfig.output);

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
  const compareButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-compare]');
  if (compareButton) {
    const comparison = document.getElementById(compareButton.getAttribute('aria-controls') ?? '');
    if (!comparison) return;
    const expanded = compareButton.getAttribute('aria-expanded') === 'true';
    compareButton.setAttribute('aria-expanded', String(!expanded));
    comparison.hidden = expanded;
    compareButton.textContent = expanded ? 'Before & after' : 'Hide comparison';
    return;
  }

  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-download]');
  if (!button) return;
  const item = state.items.find((candidate) => candidate.id === button.dataset.download);
  if (item?.result) downloadBlob(item.result.blob, item.result.name);
});

window.addEventListener('beforeunload', releaseUrls);
updateQualityTrack();

function getPageConfig(pathname: string): PageConfig {
  const pages: Record<string, PageConfig> = {
    '/png-to-webp/': {
      title: 'PNG to WebP Converter — Free & Private · Hypeberries',
      description: 'Convert PNG images to WebP for free in your browser. Preserve transparency, resize files, adjust quality, and download batches without uploading.',
      canonical: 'https://convert.hypeberries.com/png-to-webp/',
      heroTitle: 'Convert PNG to WebP',
      heroDescription: 'Private PNG-to-WebP conversion in your browser. Nothing is uploaded.',
      contextTitle: 'Why convert PNG images to WebP?',
      contextParagraphs: [
        'PNG is ideal for screenshots, logos, interface graphics, and images that need transparency, but detailed PNG files can become large. WebP keeps transparency while offering both lossy and lossless compression, making it a practical alternative for many websites.',
        'Start at 90% quality for a smaller file with a close visual match. For crisp graphics where every pixel matters, open More options and enable lossless WebP. The original PNG stays untouched on your device.',
      ],
      output: 'webp',
    },
    '/jpg-to-webp/': {
      title: 'JPG to WebP Converter — Free & Private · Hypeberries',
      description: 'Convert JPG and JPEG photos to WebP for free in your browser. Adjust quality, resize images, and batch download without uploading your files.',
      canonical: 'https://convert.hypeberries.com/jpg-to-webp/',
      heroTitle: 'Convert JPG to WebP',
      heroDescription: 'Private JPG-to-WebP conversion in your browser. Nothing is uploaded.',
      contextTitle: 'A practical WebP upgrade for JPEG photos.',
      contextParagraphs: [
        'JPEG remains useful and widely compatible, but WebP can often reduce the size of photographic website images while keeping a similar appearance. Smaller images can reduce transfer size and help pages feel faster, especially on mobile connections.',
        'Quality between 85% and 90% is a useful starting range for photographs. You can also resize oversized camera images before conversion. Orientation is applied automatically, while EXIF and location metadata are not copied into the WebP output.',
      ],
      output: 'webp',
    },
    '/png-to-avif/': {
      title: 'PNG to AVIF Converter — Free & Private · Hypeberries',
      description: 'Convert PNG images to AVIF for free in your browser. Preserve transparency, control quality, resize files, and download without uploading.',
      canonical: 'https://convert.hypeberries.com/png-to-avif/',
      heroTitle: 'Convert PNG to AVIF',
      heroDescription: 'Private PNG-to-AVIF conversion in your browser. Nothing is uploaded.',
      contextTitle: 'Use AVIF when a smaller modern image matters.',
      contextParagraphs: [
        'AVIF supports transparency and can create compact files from detailed PNG images. It is especially useful when a PNG contains photographic detail, gradients, or many colors rather than simple flat artwork.',
        'AVIF takes longer to encode than WebP, so large batches may need a little patience. Start around 90% quality, inspect the downloaded result, and lower the setting when reducing file size is more important than preserving very fine detail.',
      ],
      output: 'avif',
    },
    '/jpg-to-avif/': {
      title: 'JPG to AVIF Converter — Free & Private · Hypeberries',
      description: 'Convert JPG and JPEG photos to AVIF for free in your browser. Resize and batch-convert images locally with no uploads or account.',
      canonical: 'https://convert.hypeberries.com/jpg-to-avif/',
      heroTitle: 'Convert JPG to AVIF',
      heroDescription: 'Private JPG-to-AVIF conversion in your browser. Nothing is uploaded.',
      contextTitle: 'Make photographic images smaller with AVIF.',
      contextParagraphs: [
        'AVIF is designed for efficient modern image compression and is often a strong choice for photographs, large hero images, and other detailed website visuals. It may produce a smaller result than WebP at a comparable visual quality.',
        'Encoding AVIF is more computationally intensive, but the work stays on your device. Use the resize controls for oversized camera files, begin near 90% quality, and compare the finished file before replacing an existing website asset.',
      ],
      output: 'avif',
    },
  };

  return pages[pathname] ?? {
    title: 'Free WebP & AVIF Image Converter · Hypeberries',
    description: 'Convert JPEG, PNG, WebP and AVIF images to WebP or AVIF for free. Resize and compress files privately in your browser—nothing is uploaded.',
    canonical: 'https://convert.hypeberries.com/',
    heroTitle: 'Convert images to WebP or AVIF',
    heroDescription: 'Private, browser-based conversion. Nothing is uploaded.',
    contextTitle: 'A private image converter for everyday web work.',
    contextParagraphs: [
      'Convert JPEG, PNG, WebP, and AVIF files without sending the originals to a remote service. The browser performs the entire conversion locally, including resizing, orientation, compression, and metadata removal.',
      'The same settings can be applied to a batch of images, with individual downloads or one ZIP at the end. WebP is a dependable everyday choice; AVIF is useful when achieving the smallest practical file matters more than encoding speed.',
    ],
    output: 'webp',
  };
}

function applyPageMetadata(config: PageConfig): void {
  document.title = config.title;
  setMeta('meta[name="description"]', 'content', config.description);
  setMeta('link[rel="canonical"]', 'href', config.canonical);
  setMeta('meta[property="og:title"]', 'content', config.title);
  setMeta('meta[property="og:description"]', 'content', config.description);
  setMeta('meta[property="og:url"]', 'content', config.canonical);

  const schema = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  if (!schema?.textContent) return;
  try {
    const data = JSON.parse(schema.textContent) as Record<string, unknown>;
    data.name = config.heroTitle;
    data.url = config.canonical;
    data.description = config.description;
    schema.textContent = JSON.stringify(data);
  } catch {
    // The static schema remains usable if a browser extension alters the script.
  }
}

function setMeta(selector: string, attribute: string, value: string): void {
  document.querySelector(selector)?.setAttribute(attribute, value);
}

function setFormat(format: Format): void {
  state.format = format;
  document.querySelectorAll<HTMLInputElement>('input[name="format"]').forEach((input) => {
    input.checked = input.value === format;
  });
  state.lossless = false;
  losslessInput.checked = false;
  qualityInput.disabled = false;
  document.querySelector('.quality-group')?.classList.remove('is-disabled');
  const isWebp = format === 'webp';
  losslessInput.disabled = !isWebp;
  losslessRow.classList.toggle('is-disabled', !isWebp);
  losslessRow.querySelector('small')!.textContent = isWebp
    ? 'Preserve every pixel; the file may be larger'
    : 'Lossless mode is available for WebP output';
  invalidateResults();
}

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
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const dimensions = getOutputDimensions(sourceWidth, sourceHeight);
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
    sourceWidth,
    sourceHeight,
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
  downloadAllButton.hidden = state.items.length === 1 && completed.length === 1;

  if (state.items.length === 1 && completed.length === 1) {
    results.innerHTML = renderSingleResult(completed[0]);
    return;
  }

  results.innerHTML = completed.map((item) => {
    const difference = Math.round((1 - item.result.blob.size / item.file.size) * 100);
    const badge = sizeDifferenceLabel(difference);
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

function renderSingleResult(item: ImageItem & { result: ConvertedResult }): string {
  const difference = Math.round((1 - item.result.blob.size / item.file.size) * 100);
  const badge = sizeDifferenceLabel(difference);

  return `
    <div class="single-result">
      <article class="result-card single-result-row">
        <img src="${item.result.url}" alt="Converted preview of ${escapeHtml(item.file.name)}">
        <div class="result-copy">
          <strong title="${escapeHtml(item.result.name)}">${escapeHtml(item.result.name)}</strong>
          <span>${item.result.width} × ${item.result.height}</span>
        </div>
        <div class="size-change">
          <span>${formatBytes(item.file.size)} → <strong>${formatBytes(item.result.blob.size)}</strong></span>
          <small class="${difference > 0 ? 'saving' : difference < 0 ? 'increase' : 'neutral'}">${badge}</small>
        </div>
        <div class="result-actions">
          <button type="button" class="compare-button" data-compare aria-expanded="false" aria-controls="single-comparison">Before &amp; after</button>
          <button type="button" class="download-button" data-download="${item.id}">Download <span class="button-icon">${renderIcon(faDownload)}</span></button>
        </div>
      </article>
      <div id="single-comparison" class="comparison-disclosure" hidden>
        ${renderSingleComparison(item)}
      </div>
    </div>
  `;
}

function renderSingleComparison(item: ImageItem & { result: ConvertedResult }): string {
  const difference = Math.round((1 - item.result.blob.size / item.file.size) * 100);
  const differenceClass = difference > 0 ? 'saving' : difference < 0 ? 'increase' : 'neutral';

  return `
    <article class="single-comparison" aria-labelledby="comparison-title">
      <div class="comparison-intro">
        <div>
          <h3 id="comparison-title">Before and after</h3>
          <p>Compare the original with the converted image at the same display size.</p>
        </div>
        <span class="comparison-saving ${differenceClass}">${sizeDifferenceLabel(difference)}</span>
      </div>
      <div class="comparison-grid">
        <figure class="comparison-panel">
          <figcaption>
            <span>Before</span>
            <strong>Original</strong>
          </figcaption>
          <div class="comparison-image">
            <img src="${item.previewUrl}" alt="Original preview of ${escapeHtml(item.file.name)}">
          </div>
          <dl class="comparison-details">
            <div><dt>Size</dt><dd>${formatBytes(item.file.size)}</dd></div>
            <div><dt>Dimensions</dt><dd>${item.result.sourceWidth} × ${item.result.sourceHeight}</dd></div>
            <div><dt>Format</dt><dd>${sourceFormatLabel(item.file)}</dd></div>
          </dl>
        </figure>
        <figure class="comparison-panel comparison-after">
          <figcaption>
            <span>After</span>
            <strong>Converted</strong>
          </figcaption>
          <div class="comparison-image">
            <img src="${item.result.url}" alt="Converted preview of ${escapeHtml(item.file.name)}">
          </div>
          <dl class="comparison-details">
            <div><dt>Size</dt><dd>${formatBytes(item.result.blob.size)}</dd></div>
            <div><dt>Dimensions</dt><dd>${item.result.width} × ${item.result.height}</dd></div>
            <div><dt>Format</dt><dd>${state.format.toUpperCase()}</dd></div>
          </dl>
        </figure>
      </div>
    </article>
  `;
}

function sizeDifferenceLabel(difference: number): string {
  if (difference > 0) return `${difference}% smaller`;
  if (difference < 0) return `${Math.abs(difference)}% larger`;
  return 'Same file size';
}

function sourceFormatLabel(file: File): string {
  const format = file.type.split('/')[1];
  if (format === 'jpeg') return 'JPEG';
  return format?.toUpperCase() || 'Image';
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
