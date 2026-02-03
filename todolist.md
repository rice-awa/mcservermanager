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
☑页面结构布局
☑标题和连接信息
☑主要内容区域
```

#### 步骤 17: 实现控制台输出区域
☑使用 `ScrollArea` 组件
☑实时显示命令输出
☑区分系统消息、玩家消息、错误信息
☑自动滚动到底部
☑支持暂停滚动

#### 步骤 18: 实现命令输入组件
☑输入框组件
☑支持多行输入
☑发送按钮
☑快捷键（Enter 发送，Shift+Enter 换行）

#### 步骤 19: 实现自动补全功能
☑获取可用命令列表
☑键盘事件处理（Tab 补全）
☑下拉建议列表

#### 步骤 20: 实现命令历史
☑记录已发送命令
☑上下键浏览历史
☑本地存储持久化

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

