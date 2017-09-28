# Sarasa Gothic (更纱黑体 / 更紗黑體 / 更紗ゴシック)

This is SARASA GOTHIC, a Chinese & Japanese programming font based on Iosevka and Source Han Sans.

## To build

You need [Node.js](https://nodejs.org/en/) 8.5 (or newer), [otfcc](https://github.com/caryll/otfcc) and [AFDKO](http://www.adobe.com/devnet/opentype/afdko.html) installed, then run:

```bash
npm install
```

after the NPM packages are installed, run

```bash
node build ttf
```

to build the TTF files, it would be in `build/out` directory.

To build TTC, type

```bash
node build ttc
```

instead, the files would be in `build/ttc` directory.
