# Build Gesture Animation · 手势动画网站生成 Skill

[![GitHub stars](https://img.shields.io/github/stars/senlindesign/build-gesture-animation?style=flat&color=111111)](https://github.com/senlindesign/build-gesture-animation/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE.txt)
[![Agent Skill](https://img.shields.io/badge/Agent_Skill-compatible-111111.svg)](https://agentskills.io/)
[![Codex](https://img.shields.io/badge/OpenAI-Codex-111111.svg)](https://openai.com/codex/)
[![Claude Code](https://img.shields.io/badge/Anthropic-Claude_Code-111111.svg)](https://www.anthropic.com/claude-code)

[English README](README.en.md)

一个面向 Codex、Claude Code、Cursor 和 GitHub Copilot 的 Agent Skill，将一段连续变化的视频转换为可用手掌、双指、双手距离或嘴巴开合控制的交互式动画网站。

它把完整制作流程固化为可验证的工作流：

```text
视频准备或 Prompt → 视频检查 → 均匀抽帧 → 4:3 WebP → 手势配置
→ 响应式网站 → 自动校验 → localhost 预览
```

## 演示

https://github.com/user-attachments/assets/d9d79b90-3c65-4718-89aa-e9d92c6ad14f

## 30 秒开始

安装：

```bash
npx skills add https://github.com/senlindesign/build-gesture-animation \
  --skill build-gesture-animation
```

然后把视频和目标直接告诉 Agent：

```text
使用 build-gesture-animation，把 /absolute/path/transformation.mp4
做成一个可以用手掌开合控制的动画网站，默认 60 帧。
```

没有视频时也可以先生成制作 Prompt：

```text
使用 build-gesture-animation，帮我写一段固定镜头的视频 Prompt：
一尊大理石雕像从完整状态连续碎裂成石块，之后我要把它做成手势动画。
```

## 能做什么

- 检查视频路径、可解码性、时长、尺寸、旋转信息和真实帧数
- 默认均匀选择 60 个源帧，可配置为 24–120 帧
- 始终包含首尾状态，源视频帧数不足时不制造重复帧
- 居中裁成精确 4:3，最大 1280×960，低分辨率素材不放大
- 直接输出数字编号 WebP，默认质量 84、压缩等级 6
- 支持 Palm、Pinch、Span、Mouth 任意组合及方向反转
- 初次入镜自动校准，手离开后保持最后画面
- Swipe 负责循环切换素材，不占用主控制 Tab
- 支持 1–N 组动画素材和循环堆叠展示
- 生成响应式深色双栏网站，移动端摄像头变为可拖动浮窗
- 验证素材编号、尺寸、解码、配置引用和 MediaPipe 模型地址
- 建立项目 Task 和 Memory，逐阶段保存决策与验证证据

## 四种控制方式

| 控制 | 输入 | 典型用法 |
| --- | --- | --- |
| Palm | 手掌张开与握合 | 折叠、展开、聚合、爆炸 |
| Pinch | 拇指与食指距离 | 精细变化、缩放感、局部变形 |
| Span | 左右手之间的距离 | 拉伸、扩散、结构展开 |
| Mouth | 嘴巴张开与闭合 | 无手控制、面部驱动动画 |

每个控制都支持 `invert`，用于决定动作方向与动画首尾帧的关系。

## 为什么使用图片序列

浏览器视频的随机定位容易受关键帧间隔、解码延迟和设备差异影响。这个 Skill 将视频转成连续 WebP 帧，让手势值可以直接对应目标画面，并提供：

- 当前方向优先预加载
- 异步图片解码与缓存预热
- 中间帧渐进显示
- Canvas 分辨率限制
- 手势死区和轻微信号过滤

它保留 60 帧的细节，但不会加入人为的追帧延迟。

## 适合 / 不适合

**适合：**

- 折纸、机械结构、产品拆解与组装
- 雕塑破碎、物体生长、融化或形态变化
- 教学过程、艺术实验、互动作品集和展览网页
- 需要将同一动画绑定到不同身体输入的项目
- 多组动画素材组成的交互式作品集合

**不适合：**

- 长视频播放器或依赖音频叙事的内容
- 多镜头剪辑、频繁转场或持续移动镜头
- 实时 3D 物理模拟
- 自定义人体姿态模型或自定义 landmark 公式
- 自动部署到 Vercel 或其他云平台

## 系统要求

- Python 3.9+
- FFmpeg 和 ffprobe
- FFmpeg 的 `libwebp` 编码器
- 支持摄像头的现代浏览器
- 摄像头权限需要通过 `localhost` 或 HTTPS 使用

检查环境：

```bash
python3 scripts/check_environment.py
```

macOS 缺少 FFmpeg 时：

```bash
brew install ffmpeg
```

Skill 只负责检测并给出提示，不会擅自安装系统依赖。

## 安装

### 方式一：Skills CLI

```bash
npx skills add https://github.com/senlindesign/build-gesture-animation \
  --skill build-gesture-animation
```

### 方式二：让 Agent 安装

把下面这段话发送给有 shell 权限的 Agent：

```text
帮我安装 build-gesture-animation Agent Skill。
仓库是 https://github.com/senlindesign/build-gesture-animation。
请克隆仓库，运行 scripts/install_skill.py 安装到当前客户端，
并验证 SKILL.md、assets/、references/ 和 scripts/ 都存在。
```

### 方式三：手动安装

```bash
git clone https://github.com/senlindesign/build-gesture-animation.git
cd build-gesture-animation
```

```bash
# OpenAI Codex
python3 scripts/install_skill.py --target codex

# Claude Code
python3 scripts/install_skill.py --target claude

# Cursor
python3 scripts/install_skill.py --target cursor

# GitHub Copilot
python3 scripts/install_skill.py --target copilot
```

项目级安装：

```bash
# 通用 Agent Skills 路径
python3 scripts/install_skill.py \
  --target agents-project \
  --project-root /absolute/path/project

# GitHub Copilot 项目路径
python3 scripts/install_skill.py \
  --target copilot-project \
  --project-root /absolute/path/project
```

## 工作流程

Agent 会按以下阶段执行，并在每个 Gate 后更新 Task 与 Memory：

1. **Task & Memory**：拆分任务，建立可跨 Agent 读取的项目记录
2. **Environment**：检查 Python、FFmpeg、ffprobe 和 WebP 编码
3. **Source**：确认已有视频，或在无法生成视频时提供英文 Prompt 和 Negative Prompt
4. **Project**：确定标题、素材、帧数、控制方式和 `invert`
5. **Media**：均匀抽帧、4:3 裁切、WebP 编码并验证输出
6. **Scaffold**：写入单一配置并生成静态网站
7. **Validate**：修复失败阶段并重复验证，直到全部通过
8. **Serve**：启动 localhost，检查桌面端、手机端和摄像头层级

详细规则见 [SKILL.md](SKILL.md)。

## 配置

生成项目只使用一个 `project.config.json`：

```json
{
  "site": {
    "title": "Kinetic Atlas",
    "subtitle": "Body-driven animations"
  },
  "artworks": [
    {
      "id": "earth",
      "label": "Earth",
      "framePath": "./frames/earth",
      "frameCount": 60
    }
  ],
  "controls": [
    {
      "type": "palm",
      "invert": false,
      "instruction": "Open and close your palm."
    }
  ],
  "navigation": {
    "verticalSwipe": true,
    "loop": true
  }
}
```

## 脚本

| 脚本 | 作用 |
| --- | --- |
| `check_environment.py` | 检查系统依赖和 WebP 编码能力 |
| `prepare_media.py` | 检查视频并输出均匀选择的 4:3 WebP |
| `scaffold_site.py` | 复制网站模板并验证配置 |
| `validate_project.py` | 检查素材、配置、解码和运行时引用 |
| `serve_site.py` | 启动支持摄像头权限的 localhost 服务 |
| `install_skill.py` | 安装到 Codex、Claude Code、Cursor 或 Copilot |

常用命令：

```bash
python3 scripts/prepare_media.py \
  --input /absolute/path/source.mp4 \
  --output /absolute/path/project/frames/artwork-id \
  --frames 60

python3 scripts/validate_project.py /absolute/path/project
python3 scripts/serve_site.py /absolute/path/project
```

## 平台支持

| 平台 | 状态 | 安装位置 |
| --- | --- | --- |
| OpenAI Codex | 已验证 | `~/.codex/skills/` |
| Claude Code | 已验证 | `~/.claude/skills/` |
| Cursor | 结构兼容 | `~/.cursor/skills/` 或 `.agents/skills/` |
| GitHub Copilot | 结构兼容 | `~/.copilot/skills/` 或 `.github/skills/` |

核心包遵循 [Agent Skills 开放规范](https://agentskills.io/specification)，不依赖单一客户端专属语法。

## 目录结构

```text
build-gesture-animation/
├── SKILL.md
├── README.md
├── README.en.md
├── LICENSE.txt
├── agents/openai.yaml
├── scripts/
├── references/
└── assets/site-template/
```

Skill 不包含示例视频、用户素材或生成后的帧文件。

## 隐私与安全

- 手势和面部 landmark 只在浏览器中实时处理
- 不将摄像头画面或生物识别信息写入 Task、Memory 或配置
- MediaPipe 和模型默认通过 CDN 加载
- 源视频不会被删除或覆盖
- 替换现有输出和 Skill 安装需要显式 `--force`

## FAQ

**为什么默认是 60 帧？**  
60 帧能保留足够细腻的中间状态。快速动作通过预加载和连续显示改善，不通过固定降到 36 帧解决。

**可以直接生成视频吗？**  
取决于当前 Agent 是否具备视频生成工具。没有时，Skill 会输出英文 Prompt、Negative Prompt 和制作说明，再等待用户提供成片。

**可以使用 16:9 视频吗？**  
可以。主体和全部动作需要保持在中央 4:3 安全区，抽帧时会居中裁掉两侧。

**手离开摄像头后会怎样？**  
动画保持最后一帧。重新入镜时会重新校准，不会因初始姿势直接跳到错误状态。

**会自动部署网站吗？**  
不会。首版只生成并验证本地网站。

## License

[MIT License](LICENSE.txt)
