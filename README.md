# Sarasa Gothic (更纱黑体 / 更紗黑體 / 更紗ゴシック)

This is SARASA GOTHIC, a Chinese & Japanese programming font based on Iosevka and Source Han Sans.

## To build

You need [Node.js](https://nodejs.org/en/) 8.5 (or newer), [otfcc](https://github.com/caryll/otfcc), [AFDKO](http://www.adobe.com/devnet/opentype/afdko.html) and [ttfautohint](https://www.freetype.org/ttfautohint) installed, then run:

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

## What are the names?

- Latin/Greek/Cyrillic character set being Noto Sans
  - Quotes (`“”`) are full width —— Gothic
  - Quotes (`“”`) are narrow —— UI
- Latin/Greek/Cyrillic character set being Iosevka
  - Have ligature, Em dashes (`——`) are full width —— MonoT
  - Have ligature, Em dashes (`——`) are half width —— Mono
  - No ligature, Em dashes (`——`) are half width —— Term
