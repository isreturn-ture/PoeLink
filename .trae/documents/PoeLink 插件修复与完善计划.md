# 插件修复与优化计划

我已对你的项目进行了全面的代码审查，发现了 UI 拖拽异常、通信服务在不同上下文中的兼容性问题，以及部分业务逻辑的缺失。以下是详细的分析和修复计划。

## 第一步：问题分析

### 1. UI 拖拽功能异常
*   **现象**: 拖拽可能不流畅、位置跳变或无法拖拽。
*   **原因**: 
    *   `content.tsx` 中的 `makeDraggable` 实现存在逻辑缺陷。它直接修改 `style.left/top`，但未清除 `style.right/bottom`（CSS 类中定义了 `bottom-6 right-6`），导致定位冲突。
    *   缺乏边界检查，拖拽可能移出屏幕。
    *   在 Shadow DOM 中，事件目标 (`e.target`) 的判断可能不准确。
*   **影响**: 用户体验极差，悬浮球可能“卡”在某个位置。

### 2. 通信与运行时错误
*   **现象**: 点击“切换悬浮窗”或部分功能时可能报错或无反应。
*   **原因**: 
    *   `CommunicationService.ts` 中使用了 `browser.tabs.query`。此 API 仅在 Background 和 Popup (扩展弹窗) 中可用，在 Content Script (注入页面的 UI) 中是 **undefined**。
    *   `App.tsx` 被注入到页面中运行 (Content Script 环境)，调用该服务会导致崩溃。
*   **影响**: 核心交互功能失效。

### 3. 业务逻辑不完善
*   **现象**: 配置页面的“测试连接”是 Mock (模拟) 数据；Cookie 同步功能在 UI 上不可见；缺少日志下载入口。
*   **原因**: 代码中写死了 `setDbTestStatus('连接成功（模拟）')`，未真实调用后端接口。
*   **影响**: 插件无法真正与业务系统对接。

### 4. 权限与配置缺失
*   **原因**: `wxt.config.ts` 中未显式声明 `permissions`（如 `storage`, `cookies`, `tabs`），可能导致生产环境构建后权限不足。

---

## 第二步：修复与优化方案

### 1. 架构改进：上下文感知与事件驱动
*   **优化**: 改造 `App.tsx`，使其能感知运行环境（Popup 还是 Content Script）。
*   **实现**: 
    *   为 `App` 组件增加 `onClose` 和 `onToggleFloating` 属性。
    *   在 `content.tsx` 中将控制权（关闭、隐藏）作为回调传递给 `App`。
    *   `CommunicationService` 仅负责数据通信，移除直接的 UI 操作逻辑。

### 2. 交互修复：重写拖拽逻辑
*   **优化**: 使用更稳健的拖拽算法。
*   **实现**:
    *   拖拽开始时强制设置 `position: fixed` 并清除 `right/bottom` 样式。
    *   增加 `clamp` 函数限制坐标在 `window.innerWidth/Height` 范围内。
    *   使用 `transform` 进行位移（性能更好）或继续使用 `left/top` 但确保 CSS 优先级。

### 3. 功能补全：真实业务逻辑
*   **优化**: 实现真实的健康检查、数据库连接测试和日志下载。
*   **实现**:
    *   在 `background.ts` 中完善代理请求，解决跨域 (CORS) 问题。
    *   在 `App.tsx` 中增加“手动同步 Cookie”和“下载日志”的按钮。

---

## 第三步：执行计划

我将依次更新以下文件，为你提供一个完整可用的版本：

1.  **`wxt.config.ts`**: 补充权限声明。
2.  **`src/entrypoints/popup/services/CommunicationService.ts`**: 移除非法 API 调用，专注于消息传递。
3.  **`src/entrypoints/background.ts`**: 增强 API 代理和错误处理。
4.  **`src/entrypoints/content.tsx`**: 重写拖拽逻辑，正确传递 Props 给 App。
5.  **`src/entrypoints/popup/App.tsx`**: 接收 Props，集成真实业务逻辑，完善 UI。

请确认执行此计划。