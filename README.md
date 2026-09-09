# Compression, visualised

An interactive slide deck / explorable that walks through how lossless and lossy
compression work — from run-length encoding and Huffman codes to the full JPEG
pipeline (colour transform, chroma subsampling, DCT, quantisation, zig-zag, entropy
coding). Built as a talk with live, manipulable visuals rather than static slides.

Vue 3 + TypeScript + Vite, with Pixi.js and GSAP for rendering and animation.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build     # type-checks, then emits static files to dist/
npm run preview   # serve the production build locally
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml). Enable it once under
**Settings → Pages → Build and deployment → Source: GitHub Actions**. The site is
served from a sub-path, so `vite.config.ts` sets `base: '/compression/'` for builds.

## Sample images

The sample and portrait images are regenerated/downloaded by a script:

```bash
node scripts/generate-samples.mjs           # fills in anything missing
node scripts/generate-samples.mjs --force   # rebuilds everything
```

## Licence & credits

Source code is MIT licensed — see [LICENSE](LICENSE). Bundled images are third-party
works under their own licences; attribution is in
[public/samples/CREDITS.md](public/samples/CREDITS.md) and
[public/portraits/CREDITS.md](public/portraits/CREDITS.md).
