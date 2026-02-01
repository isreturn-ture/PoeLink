# PoeLink 浏览器插件

PoeLink 是一款基于 WXT + React 的浏览器插件，用于作为 **AMR（自动导引车）智能诊断助手**。该插件提供悬浮交互界面，支持自然语言查询 AMR 状态、故障诊断、日志分析等功能，与 PoeLink-server 后端配套使用。

## 功能特性

### 核心功能
- **悬浮交互界面** - 可拖拽、可缩放的悬浮球和弹窗，支持任意网页注入
- **智能对话系统** - 支持自然语言查询 AMR 状态、故障诊断、日志分析
- **任务流水展示** - 可视化展示 AMR 任务执行时间线，包含任务号、车号、位置等信息
- **日志下载** - 支持下载诊断日志文件
- **Cookie 自动同步** - 每 30 秒自动同步运管系统 Cookie 到后端

### AI 能力
- **意图识别** - 自动识别用户查询意图（故障排查、状态查询、日志分析、系统健康检查）
- **实体抽取** - 从自然语言中提取任务号、车号、时间范围、异常关键词等实体
- **本地规则 + LLM** - 支持本地规则匹配和 LLM API（Moonshot/OpenAI）两种模式

### 配置管理
- **4 步配置向导** - 服务器、数据库、运管系统、LLM 配置
- **连接测试** - 支持各配置项的连接测试
- **本地存储** - 配置和聊天记录持久化存储

## 技术架构

### 技术栈
- **框架**: WXT 0.20+（浏览器扩展开发框架）
- **UI**: React 19 + TypeScript
- **样式**: Tailwind CSS 4
- **构建**: Vite（通过 WXT）

### 架构设计
```
┌─────────────────────────────────────────────────────────────┐
│                     浏览器环境                              │
├─────────────────────────────────────────────────────────────┤
│  Content Script (content.tsx)                              │
│  ├─ 悬浮球 UI                                            │
│  ├─ 可拖拽弹窗                                            │
│  └─ React 应用渲染                                         │
├─────────────────────────────────────────────────────────────┤
│  Background Script (background.ts)                           │
│  ├─ 消息路由                                              │
│  ├─ API 代理（解决 CORS）                                  │
│  ├─ Cookie 同步任务                                        │
│  └─ 通知管理                                              │
├─────────────────────────────────────────────────────────────┤
│  Popup (popup/)                                           │
│  ├─ App.tsx - 主组件                                      │
│  ├─ Services/ - 服务层                                    │
│  │   ├─ CommunicationService - 通信服务                     │
│  │   ├─ StorageService - 存储服务                          │
│  │   ├─ IntentService - 意图识别                          │
│  │   └─ EntityService - 实体抽取                          │
│  └─ tailwind.css - 样式                                   │
└─────────────────────────────────────────────────────────────┘
```

### 消息通信
- **Content Script ↔ Background**: `browser.runtime.sendMessage`
- **Popup ↔ Background**: `browser.runtime.sendMessage`
- **Background ↔ Server**: `fetch` 代理请求

## 环境要求

- **Node.js**: 18.0 或更高版本
- **包管理器**: npm 或 pnpm
- **浏览器**: Chrome 88+ / Edge 88+ / Firefox 78+

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 加载扩展

#### Chrome / Edge
1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目目录下的 `.output/chrome-mv3` 文件夹

#### Firefox
```bash
npm run dev:firefox
```
按 WXT 提示操作加载扩展。

### 首次使用配置

1. 点击浏览器工具栏的 PoeLink 图标
2. 进入「开始配置」页面
3. 按向导完成 4 步配置：
   - **服务器配置**: 输入后端服务器地址和端口
   - **数据库配置**: 输入数据库连接信息
   - **运管系统配置**: 输入运管系统 IP 和端口
   - **LLM 配置**:（可选）配置 Moonshot 或 OpenAI API Key
4. 点击「保存并进入」开始使用

## 功能说明

### 悬浮球交互

#### 显示/隐藏
- 点击浏览器扩展图标，或点击页面右下角的悬浮球
- 悬浮球在弹窗显示时会自动隐藏

#### 拖拽
- 按住悬浮球或弹窗标题栏可拖拽移动
- 支持拖拽阈值判断，避免误触

#### 缩放
- 弹窗支持 8 个方向缩放（四边 + 四角）
- 最小尺寸：320×280px
- 最大尺寸：1200×900px

### 对话功能

#### 发送消息
- 在输入框输入问题，按 `Enter` 发送
- 按 `Shift+Enter` 换行

#### 支持的查询类型
- **故障排查**: "AGV-001 导航失败的原因是什么？"
- **状态查询**: "查看任务 A123456 的执行状态"
- **日志分析**: "下载最近一小时的错误日志"
- **系统健康检查**: "系统健康状态如何？"

#### 消息展示
- 用户消息：右侧蓝色气泡
- AI 消息：左侧灰色气泡
- 流式输出：支持逐字显示动画效果

### 配置向导

配置向导分为 4 个步骤，每步完成后可进行连接测试：

#### 步骤 1: 服务器配置
- **协议**: HTTP 或 HTTPS
- **主机**: 服务器地址（如 `localhost` 或 `192.168.1.100`）
- **端口**: 服务器端口（如 `7406`）

#### 步骤 2: 数据库配置
- **地址**: 数据库服务器地址
- **用户名**: 数据库用户名
- **密码**: 数据库密码

#### 步骤 3: 运管系统配置
- **IP 地址**: 运管系统 IP
- **端口**: 运管系统端口

#### 步骤 4: LLM 配置（可选）
- **API Key**: Moonshot 或 OpenAI API Key
- **提供商**: 选择 Moonshot 或 OpenAI

> **注意**: 配置 LLM 后，意图识别和实体抽取将使用 AI 模型，识别准确率更高。未配置时使用本地规则匹配。

### Cookie 同步

插件会每 30 秒自动同步运管系统的 Cookie 到后端，用于保持登录状态。支持的 Cookie 包括：
- `JSESSIONID`
- `accessToken`
- `opsAccessToken`

手动触发同步：点击聊天界面右上角「更多」→「同步 Cookie」

### 日志下载

当 AI 返回包含日志文件的消息时，点击「下载诊断日志」按钮即可下载。

手动下载：点击聊天界面右上角「更多」→「下载运行日志」

## 目录结构

```
src/
├── entrypoints/              # 扩展入口
│   ├── background.ts          # 后台脚本（消息路由、API 代理、Cookie 同步）
│   ├── content.tsx           # 内容脚本（悬浮球 UI、拖拽缩放）
│   └── popup/               # 弹窗页面
│       ├── index.html        # HTML 模板
│       ├── main.tsx         # React 入口
│       ├── App.tsx          # 主组件
│       ├── tailwind.css     # 样式文件
│       └── services/        # 服务层
│           ├── CommunicationService.ts  # 通信服务
│           ├── StorageService.ts       # 存储服务
│           ├── IntentService.ts        # 意图识别
│           └── EntityService.ts       # 实体抽取
public/
└── icon/                   # 扩展图标
```

### 文件说明

| 文件 | 说明 |
|------|------|
| [background.ts](src/entrypoints/background.ts) | 后台脚本，处理消息路由、API 代理、Cookie 同步任务 |
| [content.tsx](src/entrypoints/content.tsx) | 内容脚本，注入悬浮球 UI，实现拖拽和缩放功能 |
| [App.tsx](src/entrypoints/popup/App.tsx) | 主组件，包含欢迎页、配置页、聊天页 |
| [CommunicationService.ts](src/entrypoints/popup/services/CommunicationService.ts) | 通信服务，封装与后台和后端的通信 |
| [StorageService.ts](src/entrypoints/popup/services/StorageService.ts) | 存储服务，封装浏览器存储 API |
| [IntentService.ts](src/entrypoints/popup/services/IntentService.ts) | 意图识别服务，支持本地规则和 LLM |
| [EntityService.ts](src/entrypoints/popup/services/EntityService.ts) | 实体抽取服务，支持本地规则和 LLM |

## API 说明

### 后端 API 端点

插件通过 Background Script 代理请求后端 API，主要端点包括：

#### 健康检查
```
GET /api/health
```
返回服务器健康状态。

#### 配置验证
```
POST /api/config/validate
Content-Type: application/json

{
  "server": { "protocol": "HTTP", "host": "localhost", "port": "7406" },
  "database": { "address": "...", "user": "...", "pass": "..." },
  "ops": { "ip": "...", "port": "..." }
}
```
验证配置是否有效，返回 `config_id`。

#### 对话接口
```
POST /api/chat
Content-Type: application/json

{
  "input": "用户输入",
  "configId": "配置ID",
  "description": "意图描述",
  "intentResult": { "intent": "...", "confidence": 0.9, "description": "..." },
  "entities": { "task": "...", "robotcode": "...", ... }
}
```
返回 AI 响应，可能包含：
- `result`: 文本响应
- `data.timeline`: 任务执行流水
- `data.log_file`: 日志文件下载信息

#### Cookie 同步
```
POST /api/cookies/sync
Content-Type: application/json

{
  "server": { "host": "...", "port": "...", "protocol": "..." },
  "cookies": [...]
}
```
同步 Cookie 到后端。

#### 日志下载
```
GET /api/logs/download?filename=latest.log
```
下载日志文件。

### 消息通信协议

#### Content Script → Background
```typescript
{ type: 'TOGGLE_FLOATING' }  // 切换悬浮窗
```

#### Popup → Background
```typescript
{ type: 'PROXY_REQUEST', endpoint: '/api/...', options: {...} }  // API 代理
{ type: 'HEALTH_CHECK', server: {...} }  // 健康检查
{ type: 'VALIDATE_CONFIG', config: {...} }  // 配置验证
{ type: 'SYNC_COOKIES', data: {...} }  // Cookie 同步
{ type: 'GET_COOKIES', server: {...} }  // 获取 Cookie
{ type: 'DOWNLOAD_LOG', filename: '...' }  // 下载日志
{ type: 'TRIGGER_COOKIE_SYNC' }  // 触发 Cookie 同步
{ type: 'notify', options: {...} }  // 发送通知
```

#### Background → Content Script
```typescript
{ type: 'TOGGLE_FLOATING' }  // 切换悬浮窗
```

### 配置数据结构

```typescript
interface AppConfig {
  configId?: string;
  server: {
    protocol: 'HTTP' | 'HTTPS';
    host: string;
    port: string;
  };
  database: {
    address: string;
    user: string;
    pass: string;
  };
  ops: {
    ip: string;
    port: string;
  };
  llm?: {
    apiKey: string;
    provider: 'moonshot' | 'openai';
    baseURL?: string;
  };
}
```

## 开发指南

### 本地开发

1. 克隆仓库
```bash
git clone <repository-url>
cd PoeLink
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 加载扩展到浏览器（见「快速开始」）

### 调试

#### Content Script 调试
1. 打开任意网页
2. 按 `F12` 打开开发者工具
3. 切换到「Console」标签
4. 查看 `POELink` 相关日志

#### Background Script 调试
1. 打开 `chrome://extensions`（或 `edge://extensions`）
2. 找到 PoeLink 扩展
3. 点击「Service Worker」或「背景页」查看日志

#### Popup 调试
1. 右键点击扩展图标
2. 选择「检查弹出内容」
3. 打开开发者工具调试

### 类型检查

```bash
npm run compile
```

### 构建生产版本

```bash
npm run build
```

构建产物位于 `.output/chrome-mv3`。

### 打包扩展

```bash
npm run zip
```

生成 `.output/poelink-chrome-mv3-<version>.zip`。

## 脚本说明

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动 Chrome 开发环境 |
| `npm run dev:firefox` | 启动 Firefox 开发环境 |
| `npm run build` | 构建 Chrome 生产版本 |
| `npm run build:firefox` | 构建 Firefox 生产版本 |
| `npm run zip` | 打包 Chrome 扩展 |
| `npm run zip:firefox` | 打包 Firefox 扩展 |
| `npm run compile` | TypeScript 类型检查 |

## 故障排除

### 扩展无法加载

**问题**: 加载扩展时提示错误

**解决方案**:
1. 确认 Node.js 版本 >= 18
2. 删除 `node_modules` 和 `.output` 目录，重新 `npm install`
3. 检查 `manifest.json` 权限配置

### API 请求失败

**问题**: 对话时提示「服务暂时不可用」

**解决方案**:
1. 检查服务器配置是否正确
2. 确认后端服务是否运行
3. 检查网络连接
4. 查看浏览器控制台错误信息

### Cookie 同步失败

**问题**: Cookie 同步提示失败

**解决方案**:
1. 确认运管系统配置正确
2. 确认已登录运管系统
3. 检查浏览器 Cookie 权限
4. 查看后台脚本日志

### LLM 调用失败

**问题**: 意图识别或实体抽取失败

**解决方案**:
1. 检查 API Key 是否正确
2. 确认网络可以访问 LLM API
3. 查看浏览器控制台错误信息
4. 不配置 LLM 时会使用本地规则

### CORS 错误

**问题**: 控制台出现 CORS 错误

**解决方案**:
1. 确认所有 API 请求通过 Background Script 代理
2. 检查后端 CORS 配置
3. 确认 `host_permissions` 包含后端地址

### 权限问题

**问题**: 扩展提示权限不足

**解决方案**:
1. 检查 `manifest.json` 中的 `permissions` 和 `host_permissions`
2. 重新加载扩展
3. 在浏览器设置中授予扩展必要权限

## 配置文件

### wxt.config.ts
WXT 配置文件，包含：
- 源码目录配置
- React 模块配置
- 开发服务器端口
- Manifest 权限配置

### tailwind.config.js
Tailwind CSS 配置文件，定义：
- 内容扫描路径
- 主题扩展
- 插件配置

### tsconfig.json
TypeScript 配置文件，继承 WXT 默认配置。

## 注意事项

- 后端服务位于 POElink-server 工作区
- 若新增配置项，请同步更新 `.env.example`
- API Key 等敏感信息存储在本地浏览器存储中
- Cookie 同步功能需要运管系统在当前浏览器中登录

## 许可证

© 2026 PoeLink
