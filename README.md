# BiliBili Learning Version

[中文](#中文) | [English](#english)

---

## 中文

BiliBili Learning Version 是一个面向 Windows 的非官方 B 站学习客户端。它在保留视频网站常见使用方式的同时，从 B 站推荐和搜索结果中筛选课程、知识讲解和技能训练内容，并提供课程清单、分 P 连续播放、学习进度、课程笔记和自动更新。

> 本项目不是哔哩哔哩官方产品，与哔哩哔哩官方无隶属或合作关系。视频、评论、弹幕及其他内容版权归原作者和平台所有。

### 下载与安装

前往 [GitHub Releases](https://github.com/LukeNcCode/BiliBili_Learn/releases/latest) 下载最新的 Windows x64 安装包。

系统要求：

- Windows 10 或 Windows 11，x64
- 首次安装需要网络连接
- 内置本地语义分类模型，首次启动会占用一定 CPU 和内存

安装包目前未配置商业代码签名证书，Windows SmartScreen 可能显示提示。

### 主要功能

- 官方 B 站扫码登录，凭据保存在隔离的 Electron 会话中
- 从 B 站推荐流和搜索结果中过滤娱乐内容、广告卡片与营销卡片
- 本地语义模型进行学习科目分类，不需要将视频元数据发送到模型 API
- 中英文 UI、深色与浅色主题
- 独立 DASH 播放器、清晰度切换、3 倍速、音量、弹幕开关和后台播放
- 视频分 P 连续播放、合集与章节概览、真实播放进度记录
- 学习清单导入、发现、搜索、离线 JSON 加载
- 可视化清单制作、片段时间线编辑和 GitHub 仓库发布
- 评论与二级回复浏览，支持热门评论排序和表情显示
- 课程笔记、截图、迷你播放器及 Windows 媒体控制
- GitHub Releases 自动更新

### 自动更新

正式安装版默认检查以下仓库的 GitHub Releases：

`LukeNcCode/BiliBili_Learn`

应用启动后会自动检查更新，也可以在“设置 → 软件更新”中手动检查、下载并重启安装。自动更新只适用于通过 NSIS 安装包安装的版本，不适用于开发模式或 `win-unpacked` 目录。

### 学习清单与制作模式

学习清单是可以从公共 GitHub 仓库或本地 JSON 文件加载的课程集合。清单通常包含课程、章节、视频、分 P 和可选片段。

制作模式支持：

- 不以学习过滤条件搜索 B 站视频
- 将单个视频、指定分 P、完整合集或合集子集加入清单
- 对每个视频设置整段播放或指定片段时间
- 在右侧清单库中按课程、章节和合集管理内容
- 导出 JSON 或发布到 GitHub 仓库

示例清单位于 [examples/learning-list.json](examples/learning-list.json)。

### 本地数据与隐私

播放进度、历史、收藏、观看时长、学习清单和课程笔记保存在 Electron 的 `userData` 目录中。小型界面偏好保存在 localStorage。数据写入使用原子临时文件，并保留备份。

GitHub Token 使用 Electron `safeStorage` 加密保存，不会包含在导出的学习清单中。

视频元数据和学习分类在本地运行。应用仍会访问 B 站接口、B 站媒体 CDN、GitHub API 与 GitHub Releases。

### 本地开发

```powershell
pnpm install
pnpm dev
```

验证：

```powershell
pnpm check
pnpm audit --prod
```

构建本地安装包：

```powershell
pnpm package:win
```

构建目录版用于冒烟测试：

```powershell
pnpm package:dir
pnpm smoke:packaged
```

构建产物位于 `release-artifacts/`。旧 `release/` 目录只包含历史开发产物，不应分发。

### 发布流程

1. 更新 `package.json` 中的版本号。
2. 提交并推送 `main`。
3. 创建并推送对应的 `vX.Y.Z` 标签。
4. GitHub Actions 会执行测试、生成 NSIS 安装包、差分文件和 `latest.yml`，然后创建 Release。

### 第三方组件与声明

- HarmonyOS Sans 通过 `harmonyos-sans-sc-webfont-splitted` 内置。
- 本地语义模型来源和许可证见 [MODEL-NOTICE.md](MODEL-NOTICE.md)。
- 第三方依赖保留各自许可证。
- 项目级开源许可证尚未声明；在明确许可证前，不应将源代码视为已获得再分发授权。

---

## English

BiliBili Learning Version is an unofficial Windows desktop learning client for Bilibili. It keeps familiar video-site workflows while retaining courses, educational explanations and skill-training content from Bilibili recommendations and search results. It adds learning lists, continuous part playback, progress tracking, course notes and automatic updates.

> This project is not affiliated with or endorsed by Bilibili. Videos, comments, danmaku and other content remain the property of their respective creators and platform.

### Download and installation

Download the latest Windows x64 installer from [GitHub Releases](https://github.com/LukeNcCode/BiliBili_Learn/releases/latest).

Requirements:

- Windows 10 or Windows 11, x64
- Network access for the initial installation
- The bundled local semantic model uses additional CPU and memory during startup

The installer does not currently use a commercial code-signing certificate, so Windows SmartScreen may show a warning.

### Features

- Official Bilibili QR-code login in an isolated Electron session
- Entertainment, advertising and marketing filtering for recommendations and search
- Local semantic subject classification without sending video metadata to a model API
- Chinese and English UI with dark and light themes
- Standalone DASH player with quality switching, up to 3x speed, volume, danmaku and background playback
- Continuous multi-part playback, series/chapter overview and persisted per-part progress
- Learning-list discovery, search, repository import and offline JSON loading
- Visual learning-list creator, segment timeline editor and GitHub publishing
- Top-sorted comments and expandable reply threads
- Course notes, screenshots, mini player and Windows media controls
- Automatic updates through GitHub Releases

### Automatic updates

Installed official builds check the GitHub Releases of:

`LukeNcCode/BiliBili_Learn`

Updates are checked after startup and can also be checked manually in **Settings → Software updates**. Automatic updates only apply to NSIS-installed builds, not development mode or the `win-unpacked` directory.

### Learning lists and creator mode

Learning lists are course collections loaded from public GitHub repositories or local JSON files. They can contain courses, sections, lessons, parts and optional playback segments.

Creator mode supports:

- Searching Bilibili without the learning-content filter
- Adding videos, selected parts, complete series or selected series episodes
- Choosing full playback or selected timeline segments per video
- Managing content by course, section and collection in the project library
- Exporting JSON or publishing directly to a GitHub repository

See [examples/learning-list.json](examples/learning-list.json) for the manifest format.

### Local data and privacy

Playback progress, history, saved videos, watch time, learning lists and course notes are stored in Electron's `userData` directory. Small UI preferences remain in localStorage. Data files use atomic writes and retain backups.

GitHub tokens are encrypted with Electron `safeStorage` and are never included in exported lists.

Video metadata and learning classification run locally. The application still connects to Bilibili APIs and media CDNs, GitHub APIs and GitHub Releases.

### Development

```powershell
pnpm install
pnpm dev
```

Verification:

```powershell
pnpm check
pnpm audit --prod
```

Build a local installer:

```powershell
pnpm package:win
```

Build and smoke-test an unpacked application:

```powershell
pnpm package:dir
pnpm smoke:packaged
```

Artifacts are written to `release-artifacts/`. The legacy `release/` directory contains historical development builds and must not be distributed.

### Release process

1. Update the version in `package.json`.
2. Commit and push `main`.
3. Create and push the matching `vX.Y.Z` tag.
4. GitHub Actions runs tests, builds the NSIS installer, block map and `latest.yml`, then creates the GitHub Release.

### Third-party notices

- HarmonyOS Sans is bundled through `harmonyos-sans-sc-webfont-splitted`.
- Local model provenance and licensing are documented in [MODEL-NOTICE.md](MODEL-NOTICE.md).
- Third-party dependencies retain their respective licenses.
- A project-wide open-source license has not yet been declared. Until one is added, the source code should not be treated as licensed for redistribution.
