# Compression Techniques Survey

A survey of common compression techniques and how popular file formats combine
them into pipelines.

## Table 1 — Common individual compression techniques

| ID | Technique | Category | Lossy? | What it does |
|----|-----------|----------|--------|--------------|
| **T1** | Color-space transform (e.g. RGB→YCbCr) | Decorrelation | Lossless* | Separates luminance from chroma so each can be treated/compressed differently. |
| **T2** | Chroma subsampling (4:2:0, 4:2:2) | Perceptual reduction | Lossy | Stores color at lower resolution than brightness, exploiting eye's low color acuity. |
| **T3** | DCT (Discrete Cosine Transform) | Transform coding | Lossless* | Converts blocks of samples into frequency coefficients that compact energy into a few terms. |
| **T4** | DWT (Discrete Wavelet Transform) | Transform coding | Lossless* | Multi-resolution transform; good energy compaction without hard block edges. |
| **T5** | MDCT (Modified DCT) | Transform coding | Lossless* | Overlapping DCT used for audio to avoid block artifacts between frames. |
| **T6** | Quantization (scalar/vector) | Precision reduction | **Lossy** | Rounds transform coefficients to fewer levels — the main "lossy" knob. |
| **T7** | Predictive / delta coding (DPCM, filtering, intra/inter prediction, LPC) | Decorrelation | Lossless* | Stores differences from a predicted value instead of raw values. |
| **T8** | Motion compensation (inter-frame prediction) | Temporal decorrelation | Lossless* | Predicts a video frame from previous/future frames plus motion vectors. |
| **T9** | Run-Length Encoding (RLE) | Entropy/pre-coding | Lossless | Replaces runs of repeated symbols with (value, count). |
| **T10** | Zig-zag / coefficient reordering | Reordering | Lossless | Orders 2D coefficients low→high frequency to create long zero runs for RLE. |
| **T11** | Huffman coding | Entropy coding | Lossless | Assigns short bit codes to frequent symbols, long codes to rare ones. |
| **T12** | Arithmetic / range coding | Entropy coding | Lossless | Encodes a whole message as one fractional number; beats Huffman near optimal entropy. |
| **T13** | ANS (rANS / tANS / FSE) | Entropy coding | Lossless | Modern entropy coder with arithmetic-like ratios at Huffman-like speed. |
| **T14** | Golomb–Rice coding | Entropy coding | Lossless | Efficient codes for geometrically-distributed residuals (common in audio/lossless). |
| **T15** | LZ77 / LZSS (dictionary) | Dictionary | Lossless | Replaces repeated byte sequences with (distance, length) back-references. |
| **T16** | LZ78 / LZW | Dictionary | Lossless | Builds an explicit dictionary of growing phrases as it scans. |
| **T17** | BWT (Burrows–Wheeler Transform) | Reversible reordering | Lossless | Permutes data to group similar contexts, making it more compressible. |
| **T18** | MTF (Move-to-Front) | Pre-coding | Lossless | Turns locally-repeated symbols into small numbers (pairs well with BWT). |
| **T19** | Context modeling / mixing (PPM, CABAC contexts) | Modeling | Lossless | Predicts next-symbol probabilities from surrounding context to feed an entropy coder. |
| **T20** | Palette / indexed color | Precision reduction | Lossy** | Maps image to a small color table; pixels become table indices. |
| **T21** | Psychoacoustic modeling | Perceptual reduction | **Lossy** | Discards audio that is masked/inaudible, guiding where to quantize hardest. |
| **T22** | Vector quantization (codebooks) | Precision reduction | **Lossy** | Encodes groups of samples as the nearest entry in a shared codebook. |

\* Mathematically reversible in isolation, but usually paired with quantization (T6) that introduces the loss.
\*\* Lossless once the palette is fixed; building the palette from a richer image is lossy.

## Table 2 — Formats and their compression pipelines

| Format | Kind | Pipeline (in order) | Notes |
|--------|------|---------------------|-------|
| **JPEG** | Image (lossy) | T1 → T2 → T3 → T6 → T10 → T9 → T11 (T12 optional) | The classic JPEG pipeline. |
| **PNG** | Image (lossless) | T7 (per-row filters) → T15 + T11 (Deflate) | No transform/quantization → always lossless. |
| **GIF** | Image (lossless palette) | T20 → T16 (LZW) | Limited to 256 colors. |
| **WebP (lossy)** | Image (lossy) | T7 (intra pred) → T3 → T6 → T12 | From VP8 keyframe coding. |
| **WebP (lossless)** | Image (lossless) | T1 + T7 (color/predict transforms) → T15 + T11 | Adds a color cache on top. |
| **JPEG 2000** | Image (both) | T1 → T4 → T6 → T19 + T12 (EBCOT/MQ-coder) | Wavelets instead of blocked DCT. |
| **HEIF / HEIC** | Image (lossy) | HEVC intra: T7 → T3-like → T6 → T12 (CABAC) | A single still frame of H.265. |
| **AVIF** | Image (both) | AV1 intra: T7 → T3-like → T6 → T12 | A single still frame of AV1. |
| **BMP (RLE)** | Image (lossless) | T9 | Optional simple RLE modes only. |
| **MP3** | Audio (lossy) | T5 (+subband) → T21 → T6 → T11 | Psychoacoustics drive quantization. |
| **AAC** | Audio (lossy) | T5 → T21 → T6 → T11 (T12 in some profiles) | Successor to MP3, same family. |
| **Ogg Vorbis** | Audio (lossy) | T5 → T21 → T22 → T11 (codebooks) | Uses vector-quantized codebooks. |
| **Opus** | Audio (lossy) | T7 (LPC/SILK) + T5 (CELT) → T21 → T12 (range) | Switches/blends speech + music coders. |
| **FLAC** | Audio (lossless) | T7 (linear prediction) → T14 (Rice) | Predict, then Rice-code residuals. |
| **ALAC** | Audio (lossless) | T7 → T14 | Apple's FLAC equivalent. |
| **ZIP / gzip** | General (lossless) | T15 + T11 (Deflate) | The workhorse general-purpose codec. |
| **bzip2** | General (lossless) | T9 → T17 → T18 → T9 → T11 | Block-sorting; slower, often smaller than gzip. |
| **7-Zip / xz (LZMA)** | General (lossless) | T15 → T19 + T12 (range) | High ratio via context-modeled range coding. |
| **Zstandard** | General (lossless) | T15 → T13 (FSE) + T11 | Tunable speed/ratio; trained dictionaries. |
| **Brotli** | General (lossless) | T15 → T19 + T11 (+ static dictionary) | Web-oriented; ships a built-in text dictionary. |
| **H.264 / AVC** | Video (lossy) | T8 + T7 → T3-like → T6 → T11/T12 (CAVLC/CABAC) | Adds temporal prediction over images. |
| **H.265 / HEVC** | Video (lossy) | T8 + T7 → T3-like → T6 → T12 (CABAC) | HEIC is its still-frame form. |
| **VP9 / AV1** | Video (lossy) | T8 + T7 → T3-like → T6 → T12 | AVIF is AV1's still-frame form. |

## Patterns worth noticing

- **Lossy media = "transform → quantize → entropy-code."** JPEG (T3/T6), MP3 (T5/T6),
  and video codecs all share this skeleton; only the transform and modeling differ.
  Quantization (T6) is where the loss lives.
- **Lossless data = "decorrelate → entropy-code."** PNG, FLAC, gzip, and bzip2 all first
  make data more predictable (prediction, dictionary, or BWT), then hand it to
  Huffman/arithmetic/ANS.
- **Entropy coding is the universal last stage.** Almost everything ends in Huffman (T11),
  arithmetic/range (T12), or ANS (T13).
- **"Formats" are often nested.** HEIC/AVIF are literally single frames of the HEVC/AV1
  video codecs; ZIP is just a container around Deflate.
