# Minecraft 服务器管理后台 ☐详细开发计划

## 项目概述

基于 React + Vite + shadcn/ui 构建的 Minecraft Java 服务器远程管理 WebUI，支持远程控制台、服务器状态监控、玩家管理等功能。

---

## 一、前端开发

### 1.1 项目初始化（第1-2步）

#### 步骤 1: 创建 Vite 项目
```bash
# 在项目根目录创建 frontend 目录
mkdir frontend

# 创建 React + TypeScript 项目
npm create vite@latest frontend -☐--template react-ts

# 进入项目目录
cd frontend

# 安装基础依赖
npm install
```

#### 步骤 2: 配置 TypeScript 和路径别名
☐配置 `tsconfig.json` 中的 `paths` 别名
☐设置 `@/*` 指向 `src/*`
☐配置 `vite.config.ts` 中的路径解析

#### 步骤 3: 安装 Tailwind CSS
```bash
# 安装 Tailwind CSS
npm install -D tailwindcss postcss autoprefixer

# 初始化配置
npx tailwindcss init -p
```

#### 步骤 4: 配置 Tailwind
☐编辑 `tailwind.config.js`，配置 content 路径
☐在 `src/index.css` 中添加 Tailwind 指令
☐创建 `tailwind.config.ts`（TypeScript 版本）

---

### 1.2 集成 shadcn/ui（第5-8步）

#### 步骤 5: 初始化 shadcn/ui
```bash
npx shadcn@latest init
```

配置选项：
☐风格: Default
☐基础颜色: Zinc
☐CSS 变量: Yes
☐响应式设计: Yes

#### 步骤 6: 安装基础组件
```bash
npx shadcn@latest add button card input textarea label select
npx shadcn@latest add badge separator scroll-area tabs toast
npx shadcn@latest add dropdown-menu dialog table avatar
```
-------------------------------------

#### 步骤 7: 配置全局样式
☐在 `src/index.css` 中配置 CSS 变量
☐创建暗色主题的 CSS 变量覆盖
☐设置字体和基础样式

#### 步骤 8: 安装额外依赖
```bash
npm install react-router-dom clsx tailwind-merge lucide-react
npm install recharts socket.io-client date-fns
```

---

### 1.3 项目结构搭建（第9-12步）

#### 步骤 9: 创建目录结构
```
frontend/src/
├── components/
│   ├── ui/           # shadcn 基础组件
│   ├── layout/       # 布局组件（Sidebar, Header）
│   ├── console/      # 控制台相关组件
│   ├── dashboard/    # 仪表盘组件
│   └── players/      # 玩家管理组件
├── pages/            # 页面组件
├── hooks/            # 自定义 Hooks
├── lib/              # 工具函数
├── services/         # API 服务
├── store/            # 状态管理
├── types/            # TypeScript 类型定义
└── assets/           # 静态资源
```

#### 步骤 10: 创建基础类型定义
☐创建 `src/types/index.ts`
☐定义 ServerConfig, Player, ServerStats, ConsoleMessage 等类型

#### 步骤 11: 创建工具函数
☐创建 `src/lib/utils.ts`（cn 工具函数）
☐创建 `src/lib/formatters.ts`（格式化工具）

#### 步骤 12: 配置 React Router
☐创建 `src/router/index.tsx`
☐配置路由规则和路由守卫
☐创建页面组件占位符

---

### 1.4 布局组件开发（第13-15步）

#### 步骤 13: 创建主布局组件
```typescript
// src/components/layout/MainLayout.tsx
☑左侧固定 Sidebar
☑右侧主内容区
☑响应式设计（移动端折叠）
```

#### 步骤 14: 创建 Sidebar 组件
☑Logo 区域
☑导航菜单（控制台、仪表盘、玩家、设置）
☑当前连接状态指示
☑用户信息区域

#### 步骤 15: 实现主题切换
☑创建 `src/hooks/use-theme.ts`
☑支持亮色/暗色主题切换
☑持久化存储用户偏好

---

### 1.5 控制台页面开发（第16-20步）

#### 步骤 16: 创建控制台页面框架
```typescript
// src/pages/Console.tsx
☐页面结构布局
☐标题和连接信息
☐主要内容区域
```

#### 步骤 17: 实现控制台输出区域
☐使用 `ScrollArea` 组件
☐实时显示命令输出
☐区分系统消息、玩家消息、错误信息
☐自动滚动到底部
☐支持暂停滚动

#### 步骤 18: 实现命令输入组件
☐输入框组件
☐支持多行输入
☐发送按钮
☐快捷键（Enter 发送，Shift+Enter 换行）

#### 步骤 19: 实现自动补全功能
☐获取可用命令列表
☐键盘事件处理（Tab 补全）
☐下拉建议列表

#### 步骤 20: 实现命令历史
☐记录已发送命令
☐上下键浏览历史
☐本地存储持久化

---

### 1.6 仪表盘页面开发（第21-25步）

#### 步骤 21: 创建统计卡片组件
☐TPS 卡片（当前值 + 趋势）
☐CPU 占用卡片
☐内存使用卡片
☐在线玩家数卡片

#### 步骤 22: 实现 TPS 趋势图
☐使用 Recharts 库
☐折线图展示历史数据
☐颜色标识健康状态（绿/黄/红）

#### 步骤 23: 实现资源使用图表
☐CPU 历史趋势图
☐内存使用图表
☐双 Y 轴展示（可选）

#### 步骤 24: 创建服务器信息面板
☐服务端版本
☐游戏模式
☐已加载区块数
☐游戏规则设置

#### 步骤 25: 实现数据自动刷新
☐定时轮询或 WebSocket 推送
☐设置刷新间隔
☐显示最后更新时间

---

### 1.7 玩家管理页面开发（第26-29步）

#### 步骤 26: 创建玩家列表组件
☐表格展示玩家信息
☐分页功能
☐排序功能

#### 步骤 27: 实现玩家信息展示
☐玩家名称
☐在线时长
☐延迟（Ping）
☐坐标位置

#### 步骤 28: 实现搜索和筛选
☐按名称搜索
☐按在线状态筛选
☐组合筛选

#### 步骤 29: 创建玩家操作菜单
☐发送私信
☐查看详情
☐执行封禁（需确认）

---

### 1.8 连接管理页面（第30-32步）

#### 步骤 30: 创建连接配置表单
☐服务器地址输入
☐RCON 端口输入
☐密码输入（掩码显示）
☐连接超时设置

#### 步骤 31: 实现连接管理
☐测试连接功能
☐保存/删除配置
☐配置列表展示
☐快速切换服务器

#### 步骤 32: 实现连接状态处理
☐连接中状态提示
☐成功连接反馈
☐错误信息展示
☐自动重连机制

---

## 二、后端开发

### 2.1 项目初始化（第33-35步）

#### 步骤 33: 创建后端项目
```bash
# 在项目根目录创建 backend 目录
mkdir backend

# 初始化 npm
cd backend
npm init -y

# 安装 TypeScript
npm install -D typescript ts-node @types/node

# 初始化 tsconfig.json
npx tsc --init
```

#### 步骤 34: 安装后端依赖
```bash
npm install express socket.io cors rcon-client
npm install -D typescript @types/express @types/cors @types/node
```

#### 步骤 35: 配置 TypeScript
☐配置 `tsconfig.json`
☐设置编译目标为 ES2020
☐配置模块系统
☐设置输出目录

---

### 2.2 基础架构（第36-38步）

#### 步骤 36: 创建项目结构
```
backend/src/
├── index.ts           # 入口文件
├── config/            # 配置文件
├── services/          # 服务层
│   ├── rcon.service.ts
│   ├── stats.service.ts
│   └── spark.service.ts
├── handlers/          # WebSocket 处理器
├── types/             # 类型定义
└── utils/             # 工具函数
```

#### 步骤 37: 创建入口文件和 WebSocket 服务
☐创建 `src/index.ts`
☐配置 Express 服务器
☐集成 Socket.io
☐配置 CORS

#### 步骤 38: 创建基础工具函数
☐日志记录器
☐配置文件读取
☐错误处理中间件

---

### 2.3 RCON 服务（第39-41步）

#### 步骤 39: 实现 RCON 连接管理
```typescript
// src/services/rcon.service.ts
class RconService {
  connect(config: ServerConfig): Promise<void>
  send(command: string): Promise<string>
  disconnect(): void
  isConnected(): boolean
}
```

#### 步骤 40: 实现命令发送
☐发送命令到 Minecraft 服务器
☐解析响应内容
☐错误处理和重试

#### 步骤 41: 实现连接池管理
☐多服务器连接支持
☐连接复用
☐断线重连逻辑

---

### 2.4 Spark Mod API 集成（第42-44步）

#### 步骤 42: 了解 Spark Mod API
Spark Mod 提供 HTTP API 获取服务器数据：
☐`/spark/api/report` ☐获取性能报告
☐`/spark/api/thread` ☐获取线程信息
☐`/spark/api/memory` ☐获取内存使用

#### 步骤 43: 实现 Spark API 客户端
```typescript
// src/services/spark.service.ts
class SparkService {
  getReport(): Promise<SparkReport>
  getTPS(): Promise<TPSData>
  getMemory(): Promise<MemoryData>
}
```

#### 步骤 44: 数据解析和格式化
☐解析 Spark API 响应
☐转换为统一格式
☐缓存机制优化

---

### 2.5 WebSocket 处理器（第45-47步）

#### 步骤 45: 实现连接处理器
```typescript
// src/handlers/socket.handler.ts
io.on('connection', (socket) => {
  socket.on('connect', handleConnect)
  socket.on('disconnect', handleDisconnect)
  socket.on('error', handleError)
})
```

#### 步骤 46: 实现命令处理器
☐接收客户端命令
☐通过 RCON 发送
☐返回执行结果

#### 步骤 47: 实现状态推送
☐定时采集服务器状态
☐通过 WebSocket 推送到客户端
☐批量更新优化

---

### 2.6 REST API（第48-50步）

#### 步骤 48: 配置管理 API
```
GET    /api/configs          # 获取所有配置
POST   /api/configs          # 创建配置
PUT    /api/configs/:id      # 更新配置
DELETE /api/configs/:id      # 删除配置
POST   /api/configs/:id/test # 测试连接
```

#### 步骤 49: 日志查询 API
```
GET    /api/logs             # 获取日志列表
GET    /api/logs/:id         # 获取单个日志
DELETE /api/logs/:id         # 删除日志
GET    /api/logs/export      # 导出日志
```

#### 步骤 50: 用户认证 API（可选）
```
POST   /api/auth/login       # 用户登录
POST   /api/auth/register    # 用户注册
POST   /api/auth/logout      # 登出
GET    /api/auth/me          # 获取当前用户
```

---

## 三、集成与测试

### 3.1 前端集成（第51-53步）

#### 步骤 51: WebSocket 服务封装
```typescript
// src/services/socket.service.ts
class SocketService {
  connect(): void
  disconnect(): void
  on(event: string, callback: Function): void
  emit(event: string, data: any): void
}
```

#### 步骤 52: 连接状态管理
☐使用 Context API 或 Zustand
☐全局状态：连接状态、当前服务器、错误信息
☐状态持久化

#### 步骤 53: 错误处理
☐全局错误边界
☐Toast 提示
☐重试机制

---

### 3.2 功能测试（第54-56步）

#### 步骤 54: 连接测试
☐测试 RCON 连接
☐测试 WebSocket 连接
☐测试断线重连

#### 步骤 55: 控制台测试
☐测试命令发送
☐测试响应显示
☐测试历史记录

#### 步骤 56: 仪表盘测试
☐测试数据更新
☐测试图表展示
☐测试状态刷新

---

### 3.3 性能优化（第57-59步）

#### 步骤 57: 前端优化
☐代码分割（懒加载）
☐组件 memo 化
☐虚拟列表（大数据量）

#### 步骤 58: 后端优化
☐连接池管理
☐缓存机制
☐请求限流

#### 步骤 59: 网络优化
☐数据压缩
☐心跳间隔优化
☐批量更新

---

## 四、待定功能（后续迭代）

☐[ ] 用户权限管理
☐[ ] 计划任务功能
☐[ ] 多服务器统一管理
☐[ ] 移动端适配优化
☐[ ] 国际化支持
☐[ ] 插件系统扩展

---

## 依赖清单

### 前端依赖
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "socket.io-client": "^4.7.0",
  "recharts": "^2.10.0",
  "lucide-react": "^0.294.0",
  "date-fns": "^2.30.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^2.0.0"
}
```

### 后端依赖
```json
{
  "express": "^4.18.0",
  "socket.io": "^4.7.0",
  "cors": "^2.8.5",
  "rcon-client": "^4.2.3",
  "axios": "^1.6.0"
}
```

---

## 开发流程

1. **每日开发**：
   ☐领取一个任务
   ☐创建分支
   ☐开发完成提 PR
   ☐代码审查合并

2. **提交规范**：
   ☐feat: 新功能
   ☐fix: 修复 bug
   ☐refactor: 重构
   ☐style: 格式调整
   ☐docs: 文档更新

3. **测试流程**：
   ☐单元测试
   ☐集成测试
   ☐手动测试
   ☐回归测试
