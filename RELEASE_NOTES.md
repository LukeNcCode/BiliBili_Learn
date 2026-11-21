# BiliBili Learning Version 0.2.1

## 中文

本次更新重点修复了自动更新配置无法识别的问题。

- 修复云端构建写入 `owner/repository` 后仍显示“发布构建尚未配置 GitHub 仓库”的问题。
- 修复更新器读取打包元数据时缺少 `path` 模块声明的问题。
- 正式安装版现在默认使用 `LukeNcCode/BiliBili_Learn` 的 GitHub Releases。
- 修复发布流程并发上传导致重复 Release 的问题。
- 新增更新地址解析测试、双语 README 和本地打包版设置页冒烟测试。

### 安装

下载 `BiliBili-Learning-Version-0.2.1-x64.exe` 并覆盖安装旧版本。安装版支持自动更新；`win-unpacked` 和开发模式不支持。

## English

This release fixes automatic-update configuration detection.

- Fixed the updater still reporting “GitHub release repository is not configured” after cloud builds embedded an `owner/repository` value.
- Fixed the missing `path` module declaration while reading packaged metadata.
- Official installed builds now default to the GitHub Releases of `LukeNcCode/BiliBili_Learn`.
- Fixed duplicate GitHub Releases caused by concurrent asset publishing.
- Added repository parsing tests, a bilingual README and a packaged settings-page smoke test.

### Installation

Download `BiliBili-Learning-Version-0.2.1-x64.exe` and install it over the previous version. Automatic updates are available for installed NSIS builds, not development mode or `win-unpacked`.
