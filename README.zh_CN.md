[English](https://github.com/be5invis/Sarasa-Gothic#readme) [简体中文](README-CN.md)

# Sarasa Gothic (更纱黑体 / 更紗黑體)

Sarasa Gothic 是一款免费的开源字体，基于 Iosevka 和 Source Han Sans (思源黑体) 设计，包含中日韩字符，主要用于操作系统页面和编程字体。

## 国内镜像下载站点

- 清华大学镜像源: https://mirrors.tuna.tsinghua.edu.cn/github-release/be5invis/Sarasa-Gothic
- 南京大学镜像源: https://mirror.nju.edu.cn/github-release/be5invis/Sarasa-Gothic

## 下载说明

对于一般用户，可以下载 `sarasa-gothic-ttf` 的字体包。如果您需要一款等宽编程字体，可以选择 `sarasa-mono-sc-regular.ttf` 文件，在代码编辑器中，指定字体显示为 `等距更纱黑体 SC`。

## 字体类型

Sarasa Gothic 提供了多种字重和字型的组合，以满足不同的场景和需求。

### 字重（Weight）
- Extralight：特细。
- Light：较细。
- Regular：标准字重。
- Semibold：半粗。
- Bold：粗体。

### 斜体（Italic）
- Extralightitalic 特细的斜体。
- Lightitalic 较细的斜体。
- Italic 斜体。
- Semibolditalic 半粗的斜体。
- Bold Italic 加粗的斜体。

### 字型（Variant）
对于字形，请看下方更详细的介绍

- Gothic：基本款。
- Mono：等宽字型。
- Term：更紧凑的等宽字型。
- Fixed：固定宽度字型。
- UI：专为UI界面设计的字型。

### 衬线（Serif）
在原有的字形基础上增加了 Slab Serif 特征，使其更具有辨识度。


## 字型讲解

### 风格样式

针对拉丁文（Latin）、希腊文（Greek）和西里尔文（Cyrillic）的字符集：

基于 [Inter](https://github.com/rsms/inter)：
  - **Gothic** —— 全宽引号 (`“”`)
  - **UI** —— 缩进引号 (`“”`)

基于 [Iosevka](https://github.com/be5invis/Iosevka)：
- **Mono** —— 全宽破折号 (`——`)
- **Term** —— 半宽破折号 (`——`)
- **Fixed** —— 半宽破折号，无连字 (`——`)

### 书写字形

根据特定语言和地区主要使用的字形来选择字体。更多请参考[思源黑体](https://github.com/adobe-fonts/source-han-sans) 的说明。

- `CL`: 古典字形
- `SC`：中国大陆（简体中文）
- `TC`：台湾（繁体中文）
- `HC`：香港（繁体中文）
- `J`：日文
- `K`：韩文


## 从源文件创建字体

### 要求

安装 [Node.js](https://nodejs.org/en/) 和 [ttfautohint](https://www.freetype.org/ttfautohint)

### 创建所有字体

将项目下载到本地，进入项目文件夹安装程序包。

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

请注意，创建 TTC 时将需要占用*非常高*的内存，因为有大量的子家族字符集的组合。
