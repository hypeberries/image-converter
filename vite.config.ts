import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

interface SeoPage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  heroDescription: string;
  contextTitle: string;
  contextParagraphs: [string, string];
}

const seoPages: SeoPage[] = [
  {
    slug: 'png-to-webp',
    title: 'PNG to WebP Converter — Free & Private · Hypeberries',
    description: 'Convert PNG images to WebP for free in your browser. Preserve transparency, resize files, adjust quality, and download batches without uploading.',
    h1: 'Convert PNG to WebP',
    heroDescription: 'Private PNG-to-WebP conversion in your browser. Nothing is uploaded.',
    contextTitle: 'Why convert PNG images to WebP?',
    contextParagraphs: [
      'PNG is ideal for screenshots, logos, interface graphics, and images that need transparency, but detailed PNG files can become large. WebP keeps transparency while offering both lossy and lossless compression, making it a practical alternative for many websites.',
      'Start at 90% quality for a smaller file with a close visual match. For crisp graphics where every pixel matters, open More options and enable lossless WebP. The original PNG stays untouched on your device.',
    ],
  },
  {
    slug: 'jpg-to-webp',
    title: 'JPG to WebP Converter — Free & Private · Hypeberries',
    description: 'Convert JPG and JPEG photos to WebP for free in your browser. Adjust quality, resize images, and batch download without uploading your files.',
    h1: 'Convert JPG to WebP',
    heroDescription: 'Private JPG-to-WebP conversion in your browser. Nothing is uploaded.',
    contextTitle: 'A practical WebP upgrade for JPEG photos.',
    contextParagraphs: [
      'JPEG remains useful and widely compatible, but WebP can often reduce the size of photographic website images while keeping a similar appearance. Smaller images can reduce transfer size and help pages feel faster, especially on mobile connections.',
      'Quality between 85% and 90% is a useful starting range for photographs. You can also resize oversized camera images before conversion. Orientation is applied automatically, while EXIF and location metadata are not copied into the WebP output.',
    ],
  },
  {
    slug: 'png-to-avif',
    title: 'PNG to AVIF Converter — Free & Private · Hypeberries',
    description: 'Convert PNG images to AVIF for free in your browser. Preserve transparency, control quality, resize files, and download without uploading.',
    h1: 'Convert PNG to AVIF',
    heroDescription: 'Private PNG-to-AVIF conversion in your browser. Nothing is uploaded.',
    contextTitle: 'Use AVIF when a smaller modern image matters.',
    contextParagraphs: [
      'AVIF supports transparency and can create compact files from detailed PNG images. It is especially useful when a PNG contains photographic detail, gradients, or many colors rather than simple flat artwork.',
      'AVIF takes longer to encode than WebP, so large batches may need a little patience. Start around 90% quality, inspect the downloaded result, and lower the setting when reducing file size is more important than preserving very fine detail.',
    ],
  },
  {
    slug: 'jpg-to-avif',
    title: 'JPG to AVIF Converter — Free & Private · Hypeberries',
    description: 'Convert JPG and JPEG photos to AVIF for free in your browser. Resize and batch-convert images locally with no uploads or account.',
    h1: 'Convert JPG to AVIF',
    heroDescription: 'Private JPG-to-AVIF conversion in your browser. Nothing is uploaded.',
    contextTitle: 'Make photographic images smaller with AVIF.',
    contextParagraphs: [
      'AVIF is designed for efficient modern image compression and is often a strong choice for photographs, large hero images, and other detailed website visuals. It may produce a smaller result than WebP at a comparable visual quality.',
      'Encoding AVIF is more computationally intensive, but the work stays on your device. Use the resize controls for oversized camera files, begin near 90% quality, and compare the finished file before replacing an existing website asset.',
    ],
  },
];

function generateSeoPages(): Plugin {
  return {
    name: 'generate-seo-pages',
    apply: 'build',
    closeBundle() {
      const outputRoot = resolve('dist');
      const baseHtml = readFileSync(resolve(outputRoot, 'index.html'), 'utf8');

      for (const page of seoPages) {
        const canonical = `https://convert.hypeberries.com/${page.slug}/`;
        let html = baseHtml
          .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
          .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${page.description}" />`)
          .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`)
          .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${page.title}" />`)
          .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${page.description}" />`)
          .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}" />`)
          .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${page.title}" />`)
          .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${page.description}" />`)
          .replace('"name": "Hypeberries Image Converter"', `"name": "${page.h1}"`)
          .replace('"url": "https://convert.hypeberries.com/"', `"url": "${canonical}"`)
          .replace('"description": "A free browser-based image converter for WebP and AVIF files."', `"description": "${page.description}"`)
          .replace('<h1 id="page-title">Convert images to WebP or AVIF</h1>', `<h1 id="page-title">${page.h1}</h1>`)
          .replace('<p>Private, browser-based conversion. Nothing is uploaded.</p>', `<p>${page.heroDescription}</p>`)
          .replace('A private image converter for everyday web work.', page.contextTitle)
          .replace('Convert JPEG, PNG, WebP, and AVIF files without sending the originals to a remote service. The browser performs the entire conversion locally, including resizing, orientation, compression, and metadata removal.', page.contextParagraphs[0])
          .replace('The same settings can be applied to a batch of images, with individual downloads or one ZIP at the end. WebP is a dependable everyday choice; AVIF is useful when achieving the smallest practical file matters more than encoding speed.', page.contextParagraphs[1]);

        const outputPath = resolve(outputRoot, page.slug, 'index.html');
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, html);
      }

      const cssHref = baseHtml.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
      if (!cssHref) throw new Error('Could not find the built stylesheet for the privacy page.');
      const privacyHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Privacy information for the Hypeberries browser-based image converter, including local image processing, hosting logs, cookies, and contact details." />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#f8f5f1" />
    <link rel="canonical" href="https://convert.hypeberries.com/privacy/" />
    <link rel="icon" href="/favicon.png" type="image/png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <link rel="stylesheet" crossorigin href="${cssHref}" />
    <title>Privacy · Hypeberries Image Converter</title>
  </head>
  <body>
    <header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Hypeberries Image Converter home"><img src="/images/logo.png" alt="Hypeberries" width="208" height="52" /></a><nav aria-label="Page navigation"><a href="/">Image converter</a></nav></div></header>
    <main class="legal-main">
      <section class="legal-hero"><p class="legal-back"><a href="/">← Back to the converter</a></p><h1>Privacy</h1><p>The short version: your image files stay on your device.</p></section>
      <article class="legal-content">
        <section><h2>Local image processing</h2><p>The converter decodes, resizes, and encodes images inside your browser. Image files and conversion settings are not sent to Hypeberries or to a third-party conversion service.</p></section>
        <section><h2>Metadata</h2><p>The browser applies the source image orientation and creates a new output file without copying EXIF, GPS location, comments, or other source metadata.</p></section>
        <section><h2>Hosting logs</h2><p>Like most website hosts, DreamHost may keep standard server logs when your browser requests the website files. These logs can include an IP address, browser information, timestamps, and requested URLs. They do not contain your image files or conversion settings.</p></section>
        <section><h2>Cookies, accounts, and analytics</h2><p>This converter does not use user accounts, advertising trackers, analytics, or cookies. It does not save conversion history to local storage.</p></section>
        <section><h2>Third-party assets</h2><p>The converter libraries, icons, and fonts are bundled with the website and served from the same domain. Converting an image does not require a request to a third-party API.</p></section>
        <section><h2>Contact</h2><p>Hypeberries is an independent project. For privacy questions or feedback, email <a href="mailto:fenda@hypeberries.com?subject=Image%20Converter%20privacy">fenda@hypeberries.com</a>.</p></section>
        <p class="legal-updated">Last updated: October 14, 2026</p>
      </article>
    </main>
    <footer><div class="footer-inner"><div class="footer-brand"><img src="/images/logo.png" alt="Hypeberries" width="208" height="52" /><p>Free tools made for the web.</p></div><nav class="footer-links" aria-label="Footer navigation"><a href="/">Converter</a><a href="https://widgets.hypeberries.com/">MacOS Widgets</a><a href="https://github.com/hypeberries">GitHub</a></nav><p>Independent tools by Hypeberries.<br />Made for a calmer web.</p></div></footer>
  </body>
</html>`;
      const privacyPath = resolve(outputRoot, 'privacy', 'index.html');
      mkdirSync(dirname(privacyPath), { recursive: true });
      writeFileSync(privacyPath, privacyHtml);
    },
  };
}

export default defineConfig({
  plugins: [generateSeoPages()],
  worker: {
    format: 'es',
  },
});
