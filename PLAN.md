 # 计划：Vercel 前端 + CF Tunnel 后端下的前端鉴权与真实 API/WS 接入

  ## 摘要

  在保持 Vercel 部署前端的前提下，将前端从 mock 数据切换为真实后端 API + Socket.IO，新增登录页与路由守卫，统
  一请求封装与 token 管理；后端通过 Cloudflare Tunnel 暴露在独立子域；页面级保护采用“应用内登录控制”。

  ## 关键结论（部署可行性）

  - 采用 Vercel 前端 + Cloudflare Tunnel 后端 可行，满足 HTTPS/WSS 与低改造目标。
  - 由于采用应用内登录，前端页面无需平台级访问控制；安全性由 JWT 鉴权保障。
  - 若未来要“页面未登录不可访问（平台级）”，建议切换到 全 Cloudflare + Access 或在 Vercel 前做 CF Access 反
    代。

  ## 重要接口/类型变更

  - 新增前端环境变量：
      - VITE_API_BASE_URL（例如 https://api.example.com）
      - VITE_WS_URL（例如 https://api.example.com，供 Socket.IO 使用）
  - 新增认证相关前端类型：
      - AuthToken, AuthUser，以及统一的 API 响应结构（与后端保持一致）
  - 前端新建认证相关模块：
      - src/services/apiClient.ts：封装 fetch，自动携带 Authorization: Bearer <token>
      - src/services/auth.ts：login/logout/getToken 等
      - src/services/socket.ts：使用 token 建立 Socket.IO 连接
      - src/contexts/AuthContext.tsx 或 src/hooks/useAuth.ts

  ## 实施步骤（前端）

  1. 新增 /login 页面与路由守卫
      - 新建 src/pages/LoginPage.tsx
      - 在 src/router/index.tsx 增加 /login
      - 增加受保护路由包装组件（未登录跳转 /login）
  2. 添加 Token 管理与请求封装
      - AuthContext 管理 token、用户状态、登录/登出
      - apiClient 自动附带 token，统一处理 401（触发登出）
  3. 替换 mock 服务为真实 API
      - SettingsPage：对接 /api/configs 与 /api/configs/:id/test
      - PlayersPage：对接 /api/players 与 /api/players/count
      - DashboardPage：对接 /api/stats 与 /api/stats/history
      - 移除 src/services/mock 使用路径（保留或迁移为本地 fallback）
  4. 接入 Socket.IO 实时通道
      - 建立 socketService，连接时携带 token
      - 订阅：
          - 控制台输出、执行命令
          - stats 订阅（用于仪表盘实时刷新）
          - server list 更新（用于配置列表实时同步）
  5. 环境变量与部署适配
      - Vercel：设置 VITE_API_BASE_URL / VITE_WS_URL
  ## 测试与验收
  - 未登录访问任意受保护页面：跳转 /login
  - 401 处理：token 失效自动登出并跳转登录
  - API 通路：/api/configs、/api/players、/api/stats 正常返回
  - WebSocket：Socket.IO 连接成功，控制台命令与日志能实时收发
  - 前端采用应用内登录（不做平台级页面访问控制）
  - 使用独立子域 api.example.com 暴露后端
  - 优化范围包含真实 API/WS 接入（替换 mock）


› 现在我又更新了下后端代码，实现了基础的ws和api设施，帮我重新指定前端优化计划
───────────────────────

• 已根据你最新后端实现（/api/auth/*、socket token、API 响应结构等）重新制定前端优化计划。你选择“API 不全部加鉴
  权”，所以计划里会区分“公开 API”与“需要登录的 API”，并保留可配置的路由保护策略。

• Proposed Plan


  # 计划：对接新版后端 API/WS 的前端优化（Vercel 前端 + CF Tunnel 后端）

  ## 摘要

  基于你更新后的后端（已具备基础 REST + Socket.IO + JWT 登录/刷新），前端从 mock 切换到真实 API/WS，新增登录
  流程、token 管理、请求封装与 Socket 连接，同时允许“部分 API 公开、部分需要登录”的混合模式。

  ## 关键变化/接口对齐

  - 登录接口：POST /api/auth/login
    返回：{ success: true, data: { user, tokens } }，其中 tokens = { accessToken, socketToken, expiresIn }
  - 刷新接口：POST /api/auth/refresh
    入参：{ socketToken }，返回新的 tokens
  - 用户信息：GET /api/auth/me（需要 Authorization: Bearer <accessToken>）
  - Socket.IO 认证：支持
      - 连接时 query token（必须是 socketToken）
      - 或连接后 auth 事件携带 token
  - API 响应结构：统一 ApiSuccessResponse / ApiErrorResponse
  - 目前除 /api/auth/* 外的 API 默认公开（你选择“不全部加鉴权”）

  ## 前端改造范围（按模块）

  1. 认证体系（必做）

  - 新增 src/pages/LoginPage.tsx
  - 新增 AuthContext 或 useAuth：
      - 存储 accessToken、socketToken、user
      - login() / logout() / refresh() 方法
      - accessToken 过期处理：触发 refresh() 或强制登出
  - 路由守卫策略：
      - 默认只保护需要敏感操作的页面（如控制台、设置）
      - 公开页面（如仪表盘）可不强制登录

  2. API 客户端封装（必做）

  - 新增 src/services/apiClient.ts
      - 自动解析 ApiSuccessResponse/ApiErrorResponse
      - 可配置是否携带 Authorization
      - 统一 401 处理（调用 logout()）

  3. 业务 API 对接（替换 mock）

  - src/services/* 新建真实请求层（替换 src/services/mock）
      - 配置管理：/api/configs
      - 玩家列表：/api/players
      - 仪表盘：/api/stats & /api/stats/history
  - 页面替换数据源：
      - DashboardPage.tsx：从 API 获取历史/快照（保留本地 fallback 可选）
      - PlayersPage.tsx：替换分页/搜索逻辑
      - SettingsPage.tsx：对接配置增删改与测试连接

  4. Socket.IO 实时通道（必做）

  - 新增 src/services/socket.ts
      - 连接时携带 socketToken
      - 处理 auth 事件补认证（如果采用延迟认证）
  - 事件处理映射：
      - 控制台输出、命令回显
      - stats/players 更新（按后端事件名对齐）

  5. 环境变量与部署适配

  - Vercel 环境变量：
      - VITE_API_BASE_URL = https://api.example.com
      - VITE_WS_URL = https://api.example.com
  - Socket.IO 连接地址用 VITE_WS_URL
  - CORS 已允许前端域名（后端需配置到 config.cors.origin）

  ## 公开/受保护 API 策略（符合你的选择）
  - 前端路由守卫只保护“具有控制权限”的页面（如 /console、/settings）

  - 登录成功后获取 accessToken + socketToken，/api/auth/me 返回用户
  - accessToken 失效时前端正确刷新或登出