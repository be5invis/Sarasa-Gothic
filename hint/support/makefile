#########################################
# Universal makefile for Ideohint       #
# Ideohint 通用 makefile                #
#########################################

###### SPECIAL NOTE: To use this on Windows, you may need unix tools in MSYS
###### 特别提示：在 Windows 上使用时可能需要安装 UNIX 工具，如使用 MSYS


###############################################################################
### HINTING PARAMETERS
### HINT 参数设置

# Segmentations when hinting
# 分段数，hint 部分
JHINT = 128

CVTFILE = build/_CVT.mk
FPGMFILE = build/_FPGM.mk
include $(CVTFILE)
include $(FPGMFILE)

###############################################################################
### PROGRAM SETTINGS
### 程序路径设置

# Path to node.js
NODE = node

# Path to ideohint.
IDEOHINT = $(XX_IDH_INSTANCE)

# C2Q
CUBIC2QUAD = $(XX_C2Q_INSTANCE)

# IDH sub commands
OTD2HGL = $(IDEOHINT) otd2hgl
HINTHGL = $(IDEOHINT) hint
MERGE = $(IDEOHINT) merge
MERGEHGI = $(IDEOHINT) merge
APPLYHGI = $(IDEOHINT) apply
MAKEVTT = $(IDEOHINT) vtt
PARAMADJ = $(IDEOHINT) visual
VTTSHELL = VTTShell

# Path to other programs used
OTFCCDUMP = otfccdump
OTFCCBUILD = otfccbuild --keep-average-char-width
TTFAUTOHINT = ttfautohint

###############################################################################
###### DON'T MODIFY
###### 以下部分不要随意修改

all: __build-all
measure-cvt: __measure-cvt
adjust-parameters: adjust-parameters-regular

PARAM_CVT = --CVT_PADDING=$(CVT_PADDING) --FPGM_PADDING=$(FPGM_PADDING)

include build/_tasks.mk

build/_tasks.mk : support/generate-tasks.js source/fonts.json support/makefile
	node $< -o $@ --jh $(JHINT) $(XX_USE_VTTSHELL) --config source/fonts.json --tempdir build --outdir out
