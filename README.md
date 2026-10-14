# Hypeberries Image Converter

A private, browser-only image converter for WebP and AVIF, intended for `convert.hypeberries.com`. Images are decoded, resized, and encoded locally; no image data is uploaded to a server.

## Development

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
```

The production build includes the JavaScript, WebAssembly codecs, and other static assets required by the app.

## Deploying to DreamHost

The GitHub Actions workflow deploys tagged releases to DreamHost. Add these
repository secrets in GitHub before creating the first release tag:

- `DREAMHOST_SSH_KEY`
- `DREAMHOST_HOST`
- `DREAMHOST_USER`
- `DREAMHOST_TARGET`

Set `DREAMHOST_TARGET` to the dedicated web root for `convert.hypeberries.com`.
The workflow uses `rsync --delete`, so it must not point to a shared directory.

Create and push a version tag to deploy:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Every matching tag installs dependencies with `npm ci`, builds the site, and
syncs the contents of `dist/` to DreamHost over SSH.

After the subdomain is live:

1. Add a free Let's Encrypt certificate for `convert.hypeberries.com` in DreamHost.
2. Confirm the site loads over HTTPS and redirect HTTP traffic to HTTPS in the DreamHost panel.
3. Add `https://convert.hypeberries.com/sitemap.xml` to Google Search Console.
4. Link to the converter from the main Hypeberries or Widgets website.

## Current features

- Drag-and-drop and multi-file selection
- JPEG, PNG, WebP, and AVIF input
- WebP or AVIF output
- Quality from 80–100%
- Original, preset, or custom dimensions
- Three compression-effort settings
- WebP lossless mode
- Automatic orientation and metadata removal
- Per-image size comparisons and downloads
- Batch ZIP download
- Responsive layout and keyboard-accessible controls
