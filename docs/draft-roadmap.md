


# Diractional notes
- purpose of repo: interactive slides for a tech talk "for fun" about compression
  - actually would make a nice published SPA so others can play/learn self-paced (after the talk otherwise they won't listen ;)

# General gist of content and progression
- opening framing
  - info theory
  - key people/insights/dates/techniques
  - compression as optimisation - root of evil?
- start simple
  - always show compression ratio/stats as we go here onlward
  - run length encoding (simple general technique)
    - demo on general data
    - demo on RGB bitmap (not very effective, maybe even bigger size)
    - palettise then RLE
    - split into R-G-B colour planes then RLE on each
    - key points:
      - compression is always a two-way (forward/inverse) transform
      - needs both the data/message, and a shared/understood primer
      - both lossless and lossy techniques
- introduce colour space conversion
  - intro to psychovisual compression (its anthropic - would other animals see it the same?)
  - _reframe_ from RGB to YCrCb then downsample chroma
- more clever techniques
  - huffman coding
  - interactive demo
  - touch on related techniques
- the big one: Fourier's insights
  - data as wave superposition
  - transform to/from waves
  - DCT1 and DCT2 - interactive visuals - show/animate the 64 basis images
  - now add in quantisation - psychovisual again - can drop some high-freq stuff
  - now notice RLE can compress (no zig-zag reorder yet)
  - now notice zig-zag insight helps RLE a lot
- putting it all together: the JPEG format
  - some hsitorical details on JPEG
  - the complete pipeline
- conclusions
  - look wider: audio, general data
  - more recent formats and methods
  - lossiness - subjective, anthropic
  - lossless through clever reframing of the data
  - importance of reframing - a life lesson there?






