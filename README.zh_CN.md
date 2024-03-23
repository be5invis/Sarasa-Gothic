[English](https://github.com/be5invis/Sarasa-Gothic#readme) [简体中文](README.zh_CN.md)

# Sarasa Gothic (更纱黑体 / 更紗黑體)

Sarasa Gothic 是一款免费的开源字体，基于 [Iosevka](https://github.com/be5invis/Iosevka) 和 [Source Han Sans](https://github.com/adobe-fonts/source-han-sans) 字型设计，适合在包含中日韩等多种亚洲语言之间混排的场景使用，主要用于操作系统页面和编程字体。

## 安装说明

强烈建议在更新此字体前，完全卸载已安装的旧版字体。许多操作系统或软件的字体缓存系统在处理大型TTC字体时可能会遇到问题。

## 国内镜像下载站点

- 清华大学镜像源: https://mirrors.tuna.tsinghua.edu.cn/github-release/be5invis/Sarasa-Gothic
- 南京大学镜像源: https://mirror.nju.edu.cn/github-release/be5invis/Sarasa-Gothic

## 如何下载

进入[最新发布版本](https://github.com/be5invis/Sarasa-Gothic/releases)页面，根据需要下载对应系列的字体包，下载后解压并安装。

## 下载说明

Sarasa Gothic 提供了多种字形风格、字重的组合，以满足不同的场景和需求。对于仅需安装作为编程字体的用户，推荐选择 "Mono SC"。下载后，在 IDE 设置字体为 `等距更纱黑体 SC`。

### 字型(Variant)

**更纱黑体**  
西文字符基于 [Inter](https://github.com/rsms/inter) 字型设计。
  - Gothic: 标准字型，全宽引号。
  - UI: 专为UI界面设计的字型，半宽引号。
 
**等距更纱黑体**  
西文字符基于 [Iosevka](https://github.com/be5invis/Iosevka) 字型设计。
- Mono: 等宽字型，全宽破折号。
- Term: 等宽字型，半宽破折号。
- Fixed: 等宽字型，半宽破折号，无连字。  

**Slab**: 粗衬线体。在原字形基础上增加了 Slab serif 的特征，使其更具有辨识度。

**连字** (Ligature) 遇到特定连续的字符时会进行组合，优化阅读体验。在编程语言中，连字特性也能让数学运算符号更容易的阅读，如输入 `!=` 时，会显示为 `≠`

### 地区语言(Variant)

根据特定语言和地区主要使用的字形来选择字体。

- `SC`: 简体中文
- `TC`: 台湾繁体中文
- `HC`: 香港繁体中文
- `CL`: 传统旧字形
- `J`: 日文
- `K`: 韩文

### 其他说明

**Unhinted**: 没有进行微调字形的版本，也就是使用 Iosevka 和 Source Han Sans 原版的字形。  文件大小比其他版本更小，但可能在某些字的结构上，显示没那么清晰，特别是小字号效果更为不佳。仅需要在极端的环境中，需要更小的字体文件，且不在意字体的显示清晰效果时选择。一般用户建议不选。

**TTF**: 如果不知道怎么选，选 TTF 肯定没错。但 TTF 通常体积较大。旧系统用户可选。

**TTC**: 相当于一个字体压缩包，在里面塞了很多个 TTF 的字体文件，可以包含多个 TrueType 字体的文件格式。好处就是，让文件更小。

**SuperTTC**: 是 TTC 的升级版，有更高效的打包方式，可以往里面塞更多的可变字体。进一步节省空间。


## 从源文件创建字体

### 要求

安装 [Node.js](https://nodejs.org/en/)、[AFDKO](https://github.com/adobe-type-tools/afdko) 和 [ttfautohint](https://www.freetype.org/ttfautohint)

### 创建所有字体

将项目下载到本地，从终端进入项目文件夹运行。

```bash
npm install
```

生成 TTF 文件, 将会导出到 `out/ttf` 目录。

```bash
npm run build ttf
```

生成 TTC 文件，将会导出到 `out/ttc` 目录。

```bash
npm run build ttc
```

请注意，打包 TTC 时将会占用 *非常高* 的内存，因为包含了大量的子家族字符集的组合。
