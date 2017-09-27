# Sarasa Gothic (更纱黑体 / 更紗黑體 / 更紗ゴシック)

This is SARASA GOTHIC, a Chinese & Japanese programming font based on Iosevka and Source Han Sans.

## To build

You need Node.js 8.5, otfcc and AFDKO installed, then run:

```bash
npm install bddy -g
npm install
```

after the NPM packages are installed, run

```bash
bddy all
```

to build the TTF files, it would be in `build/out` directory.

To build TTC, type

```bash
bddy ttc
```

instead, the files would be in `build/ttc` directory.
