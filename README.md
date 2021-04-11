# Sarasa Gothic (更纱黑体 / 更紗黑體 / 更紗ゴシック / 사라사고딕)

This is SARASA GOTHIC, a CJK programming font based on Iosevka and Source Han Sans.

## To build

You need [Node.js](https://nodejs.org/en/) (version 12 or newer), [otfcc](https://github.com/caryll/otfcc), [AFDKO](http://www.adobe.com/devnet/opentype/afdko.html) and [ttfautohint](https://www.freetype.org/ttfautohint) installed, then run:

```bash
npm install
```

after the NPM packages are installed, run

```bash
npm run build ttf
```

to build the TTF files, it would be in `out/ttf` directory.

To build TTC, type

```bash
npm run build ttc
```

instead, the files would be in `out/ttc` directory.

Please note that you will need *a lot of* memory to create TTCs, due to the huge quantity of subfamily-orthography combinations.

## What are the names?

- Style dimension
  - Latin/Greek/Cyrillic character set being Inter
    - Quotes (`“”`) are full width —— **Gothic**
    - Quotes (`“”`) are narrow —— **UI**
  - Latin/Greek/Cyrillic character set being Iosevka
    - Em dashes (`——`) are full width —— **Mono**
    - Em dashes (`——`) are half width —— **Term**
    - No ligature, Em dashes (`——`) are half width —— **Fixed**
- Orthography dimension
  - `CL`: Classical orthography
  - `SC`, `TC`, `J`, `K`, `HC`: Regional orthography, following [Source Han Sans](https://github.com/adobe-fonts/source-han-sans) notations.

## Mirrors

- TUNA (CN): https://mirrors.tuna.tsinghua.edu.cn/github-release/be5invis/Sarasa-Gothic
