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

#### ✅ 步骤 42: 了解 Spark Mod API
已完成。Spark通过Web API提供数据获取：
- 官方文档：https://spark.lucko.me/docs/misc/Raw-spark-data
- 命令：`spark health --upload` 上传并获取报告URL
- API：`{URL}?raw=1` 获取JSON格式数据

#### ✅ 步骤 43: 实现 Spark API 客户端
已完成。实现了基于Web API的SparkService：
```typescript
// src/services/spark.service.ts
class SparkService {
  getHealth(serverId: string): Promise<SparkHealthReport | null>
  getTPS(serverId: string): Promise<SparkTPSStats | null>
  clearCache(serverId?: string): void
}
```

**核心实现**：
1. 通过RCON执行 `spark health --upload` 命令
2. 从输出中提取报告URL（例如：https://spark.lucko.me/abc123）
3. 使用 `{URL}?raw=1` 获取JSON数据
4. 解析JSON并映射到应用数据结构
5. 实现30秒缓存机制

**数据映射**：
- TPS/MSPT: 来自 `metadata.platformStatistics`
- CPU: 来自 `metadata.systemStatistics.cpu`
- 内存: 优先使用 `platformStatistics.memory.heap`（JVM堆），转换为MB
- 磁盘: 来自 `systemStatistics.disk`，转换为GB

#### ✅ 步骤 44: 数据解析和格式化
已完成。
- ✅ 解析 Spark API JSON响应
- ✅ 转换为统一的SparkHealthReport格式
- ✅ 实现30秒缓存机制
- ✅ 单位转换（内存MB，磁盘GB）

**测试方式**：
```bash
cd backend
npx ts-node test-spark-webapi.ts [host] [port] [password]
# 示例：
npx ts-node test-spark-webapi.ts localhost 25575 your-rcon-password
```

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

#### 步骤 54: 连接测试 ✅
☑ 测试 RCON 连接 - backend/test/test-connection.ts
☑ 测试 WebSocket 连接
☑ 测试断线重连
☑ 测试 MC 服务器连接

#### 步骤 55: 控制台测试 ✅
☑ 测试命令发送 - backend/test/test-console.ts
☑ 测试多个命令
☑ 测试消息类型

#### 步骤 56: 仪表盘测试 ✅
☑ 测试数据更新 - backend/test/test-dashboard.ts
☑ 测试实时推送
☑ 测试数据有效性
☑ 测试多服务器数据

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
