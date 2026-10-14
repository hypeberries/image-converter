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
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
    <footer><div class="footer-inner"><div class="footer-brand"><img src="/images/logo.png" alt="Hypeberries" width="208" height="52" /><p>Free tools made for the web.</p></div><nav class="footer-links" aria-label="Footer navigation"><a href="/">Converter</a><a href="/wordpress-image-optimization/">WordPress plugin</a><a href="https://widgets.hypeberries.com/">MacOS Widgets</a><a href="https://github.com/hypeberries">GitHub</a></nav><p>Independent tools by Hypeberries.<br />Made for a calmer web.</p></div></footer>
  </body>
</html>`;
      const privacyPath = resolve(outputRoot, 'privacy', 'index.html');
      mkdirSync(dirname(privacyPath), { recursive: true });
      writeFileSync(privacyPath, privacyHtml);

      const pluginHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Automatically convert new WordPress JPEG and PNG uploads to WebP or AVIF on your own server. No API, account, quota, tracking, or cloud processing." />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#f8f5f1" />
    <link rel="canonical" href="https://convert.hypeberries.com/wordpress-image-optimization/" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Hypeberries" />
    <meta property="og:title" content="WordPress WebP &amp; AVIF Image Optimization Plugin · hpb" />
    <meta property="og:description" content="Convert new WordPress image uploads to WebP or AVIF locally, with no account, API, quota, or cloud service." />
    <meta property="og:url" content="https://convert.hypeberries.com/wordpress-image-optimization/" />
    <meta property="og:image" content="https://convert.hypeberries.com/images/logo.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="WordPress WebP &amp; AVIF Image Optimization Plugin · hpb" />
    <meta name="twitter:description" content="Convert new WordPress image uploads to WebP or AVIF locally, with no account, API, quota, or cloud service." />
    <link rel="stylesheet" crossorigin href="${cssHref}" />
    <title>WordPress WebP &amp; AVIF Image Optimization Plugin · hpb</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "hpb Image Optimization",
        "description": "A free WordPress plugin that converts new JPEG and PNG uploads to WebP or AVIF on the website's own server.",
        "url": "https://convert.hypeberries.com/wordpress-image-optimization/",
        "codeRepository": "https://github.com/hypeberries/image-optimization",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "WordPress",
        "isAccessibleForFree": true,
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
      }
    </script>
  </head>
  <body>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/" aria-label="Hypeberries Image Converter home"><img src="/images/logo.png" alt="Hypeberries" width="208" height="52" /></a>
        <nav aria-label="Page navigation"><a href="/">Image converter</a><a href="#how-it-works">How it works</a><a href="#requirements">Requirements</a><a href="#questions">Questions</a></nav>
      </div>
    </header>

    <main class="plugin-main">
      <section class="plugin-hero" aria-labelledby="plugin-title">
        <div class="plugin-hero-copy">
          <h1 id="plugin-title">Convert WordPress uploads to WebP or AVIF automatically.</h1>
          <p>hpb Image Optimization creates lighter versions of new JPEG and PNG uploads on your own server. Your originals stay available, and your images never pass through an outside service.</p>
        </div>
        <div class="plugin-hero-side">
          <span class="plugin-status">WordPress.org submission pending</span>
          <p>The plugin is free and open source. The official WordPress.org installation link will appear here after directory approval.</p>
          <div class="plugin-actions">
            <a class="plugin-primary" href="https://github.com/hypeberries/image-optimization" target="_blank" rel="noreferrer">View source on GitHub</a>
            <a class="plugin-secondary" href="/">Use the browser converter</a>
          </div>
        </div>
      </section>

      <figure class="plugin-preview">
        <div><img src="/images/plugin-settings.webp" width="1600" height="670" alt="hpb Image Optimization settings for automatic WebP and AVIF conversion in WordPress" /></div>
        <figcaption>Choose the output format and quality once. New JPEG and PNG uploads are converted automatically.</figcaption>
      </figure>

      <section id="how-it-works" class="plugin-section" aria-labelledby="plugin-how-title">
        <div class="plugin-section-intro"><h2 id="plugin-how-title">Set it once. Keep uploading normally.</h2><p>The plugin fits into the Media Library workflow you already use. There is no separate dashboard, credit system, or remote processing queue.</p></div>
        <ol class="plugin-list">
          <li><span>01</span><div><strong>Choose WebP or AVIF</strong><p>Select an output format and a quality from 80 to 100 in the WordPress settings screen.</p></div></li>
          <li><span>02</span><div><strong>Upload JPEG or PNG images</strong><p>WordPress creates the full-size attachment and its registered image sizes as usual.</p></div></li>
          <li><span>03</span><div><strong>Use the optimized files</strong><p>The converted attachment is used in the Media Library and on the front end while the original source files are retained.</p></div></li>
        </ol>
      </section>

      <section class="plugin-facts" aria-label="Plugin features">
        <article><h2>Local processing</h2><p>Conversions run through the image editor installed on your WordPress server. No files are sent to Hypeberries.</p></article>
        <article><h2>Safe fallback</h2><p>If conversion fails, the original upload remains intact and WordPress can continue using it normally.</p></article>
        <article><h2>No account or quota</h2><p>There is no cloud API, monthly allowance, tracking, or paid upgrade required to process images.</p></article>
      </section>

      <section id="requirements" class="plugin-section" aria-labelledby="requirements-title">
        <div class="plugin-section-intro"><h2 id="requirements-title">Your server decides which formats are available.</h2><p>The settings screen performs a real test encode before it offers WebP or AVIF.</p></div>
        <div class="plugin-copy">
          <p>WordPress uses Imagick or GD to create image files. WebP is supported on many current hosting plans. AVIF requires newer image libraries and is not available on every server.</p>
          <p>If a format is unavailable, the plugin keeps that option disabled and explains how to ask your host about support. It never selects a format your server cannot successfully create.</p>
        </div>
      </section>

      <section class="plugin-section" aria-labelledby="formats-title">
        <div class="plugin-section-intro"><h2 id="formats-title">WebP for broad support. AVIF for smaller files.</h2><p>Both formats can reduce image transfer sizes, but they make different tradeoffs.</p></div>
        <div class="plugin-copy">
          <p><strong>WebP</strong> is the dependable default. It is fast to create, widely supported, and a good fit for everyday photographs, screenshots, and transparent PNG images.</p>
          <p><strong>AVIF</strong> can produce smaller photographic files, although it usually takes longer to encode and needs explicit support from the server's image library.</p>
        </div>
      </section>

      <section class="plugin-section" aria-labelledby="privacy-title">
        <div class="plugin-section-intro"><h2 id="privacy-title">Private by construction.</h2><p>The plugin has no external conversion service to contact.</p></div>
        <div class="plugin-copy">
          <p>Images are processed inside your own WordPress installation. The plugin does not create an account, send media to Hypeberries, add analytics, or depend on an external API.</p>
          <p>The source code is available in the <a href="https://github.com/hypeberries/image-optimization" target="_blank" rel="noreferrer">public GitHub repository</a>.</p>
        </div>
      </section>

      <section id="questions" class="plugin-faq" aria-labelledby="plugin-faq-title">
        <div class="plugin-section-intro"><h2 id="plugin-faq-title">Common questions</h2><p>What the first release changes—and what it deliberately leaves alone.</p></div>
        <div class="faq-list">
          <details><summary>Does it convert images already in my Media Library?</summary><p>Not in the first release. It converts new JPEG and PNG uploads after the plugin is activated.</p></details>
          <details><summary>What happens when I upload WebP or AVIF?</summary><p>Nothing extra. Existing WebP and AVIF files, as well as GIF, SVG, and HEIC files, are left unchanged.</p></details>
          <details><summary>Does it keep my original files?</summary><p>Yes. The plugin retains the original JPEG or PNG source files while WordPress uses the converted attachment.</p></details>
          <details><summary>What happens if conversion fails?</summary><p>The original upload remains available. Incomplete converted files are cleaned up, and the attachment can fall back to the source format.</p></details>
          <details><summary>Does deleting the plugin delete images?</summary><p>No. Deactivating or uninstalling the plugin removes its settings but does not delete Media Library attachments or generated image files.</p></details>
          <details><summary>Is it free?</summary><p>Yes. There is no subscription, conversion quota, remote API, or account requirement.</p></details>
        </div>
      </section>
    </main>

    <footer><div class="footer-inner"><div class="footer-brand"><img src="/images/logo.png" alt="Hypeberries" width="208" height="52" /><p>Free tools made for the web.</p></div><nav class="footer-links" aria-label="Footer navigation"><a href="/">Converter</a><a href="/wordpress-image-optimization/">WordPress plugin</a><a href="/privacy/">Privacy</a><a href="https://widgets.hypeberries.com/">MacOS Widgets</a><a href="https://github.com/hypeberries">GitHub</a></nav><p>Independent tools by Hypeberries.<br />Made for a calmer web.</p></div></footer>
  </body>
</html>`;
      const pluginPath = resolve(outputRoot, 'wordpress-image-optimization', 'index.html');
      mkdirSync(dirname(pluginPath), { recursive: true });
      writeFileSync(pluginPath, pluginHtml);
    },
  };
}

export default defineConfig({
  plugins: [generateSeoPages()],
  worker: {
    format: 'es',
  },
});
