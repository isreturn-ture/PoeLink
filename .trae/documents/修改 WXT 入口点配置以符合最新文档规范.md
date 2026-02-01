# 修改 WXT 入口点配置以符合最新文档规范

## 分析现状

当前项目结构：
- `src/entrypoints/popup/` (目录风格，包含 index.html 和其他文件) - 符合规范
- `src/entrypoints/background.ts` (单文件风格) - 需要修改 defineBackgroundScript 为 defineBackground
- `src/entrypoints/content.ts` (单文件风格) - 基本符合规范，但需要检查

## 修改计划

### 1. 修改 background.ts
- 将 `defineBackgroundScript` 改为 `defineBackground`
- 确保所有运行时代码都在 main() 函数内

### 2. 修改 popup/index.html
- 添加必要的 manifest 选项 meta 标签
- 例如添加 `manifest.type` 等配置

### 3. 检查 content.ts
- 确保使用了正确的 `defineContentScript`
- 验证运行时代码都在 main() 函数内

### 4. 验证项目结构
- 确认所有入口点都符合 WXT 命名规范
- 确保没有直接平铺在 entrypoints/ 根目录下的相关文件

## 预期结果

修改后，项目将完全符合 WXT 最新文档的入口点规范，包括：
- 使用正确的 defineXxx() 函数
- 运行时代码在 main() 函数内
- 正确的目录结构和命名
- 必要的 manifest 配置