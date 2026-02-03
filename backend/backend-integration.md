# 后端对接文档（前端原型版）

本文档用于指导后端与当前前端原型对接，覆盖连接管理、控制台、仪表盘与玩家管理的交互协议。后续如字段调整，请同步更新 `src/types` 与本文件。

## 1. 总览

- 前端入口：Vite + React + TypeScript。
- 状态来源：当前为模拟数据，位于 `src/services/mock`。
- 目标：将模拟数据替换为真实 API/WebSocket 数据源。

## 2. 数据模型（TypeScript）

```ts
export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  password: string
  timeout?: number
  sparkApiUrl?: string
}

export interface Player {
  id: string
  name: string
  uuid: string
  onlineTime: number
  ping: number
  position?: { x: number; y: number; z: number; dimension: string }
}

export interface ServerStats {
  tps: number
  cpu: number
  memory: { used: number; max: number; allocated: number }
  onlinePlayers: number
  maxPlayers: number
  loadedChunks: number
  version: string
  gamemode: string
  difficulty: string
}

export interface TPSData {
  timestamp: number
  tps: number
}

export interface ConsoleMessage {
  id: string
  timestamp: number
  type: 'system' | 'command' | 'output' | 'error' | 'chat' | 'join' | 'leave'
  content: string
  sender?: string
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
```

## 3. REST API 约定

### 3.1 连接配置

- `GET /api/configs`：获取配置列表
- `POST /api/configs`：新建配置
- `PUT /api/configs/:id`：更新配置
- `DELETE /api/configs/:id`：删除配置
- `POST /api/configs/:id/test`：测试连接

请求示例：

```json
{
  "name": "生产服务器",
  "host": "127.0.0.1",
  "port": 25575,
  "password": "rcon-password",
  "timeout": 5000,
  "sparkApiUrl": "http://127.0.0.1:3000/spark"
}
```

返回示例：

```json
{
  "success": true,
  "message": "连接成功"
}
```

### 3.2 玩家列表（支持筛选与分页）

- `GET /api/players`

查询参数建议：
- `q`：按名称搜索
- `status`：`online | offline | all`
- `page` / `pageSize`
- `sortBy`：`name | onlineTime | ping`
- `sortOrder`：`asc | desc`

返回示例：

```json
{
  "items": [/* Player[] */],
  "total": 42,
  "page": 1,
  "pageSize": 10
}
```

### 3.3 仪表盘数据

- `GET /api/stats`：获取一次性快照
- `GET /api/stats/history`：获取历史曲线（TPS/CPU/内存）

返回示例：

```json
{
  "stats": { /* ServerStats */ },
  "tpsHistory": [/* TPSData[] */],
  "cpuHistory": [{ "timestamp": 0, "value": 0 }],
  "memoryHistory": [{ "timestamp": 0, "used": 0, "allocated": 0 }]
}
```

## 4. WebSocket 事件约定

WebSocket 用于实时控制台与数据推送，事件建议与 `WSMessage` 对齐。

### 4.1 客户端 -> 服务端

- `connect`：传入配置 id 或完整配置
```json
{ "type": "connect", "payload": { "configId": "server-1" } }
```

- `executeCommand`：发送控制台命令
```json
{ "type": "executeCommand", "payload": { "command": "list" } }
```

### 4.2 服务端 -> 客户端

- `commandOutput`：控制台输出
```json
{ "type": "commandOutput", "payload": { "message": /* ConsoleMessage */ } }
```

- `statsUpdate`：仪表盘数据推送
```json
{ "type": "statsUpdate", "payload": { "stats": /* ServerStats */ } }
```

- `playerUpdate`：玩家列表更新
```json
{ "type": "playerUpdate", "payload": { "items": [/* Player[] */] } }
```

- `error`：连接/命令错误
```json
{ "type": "error", "payload": { "message": "连接失败" } }
```

## 5. 错误格式建议

统一结构便于前端展示：

```json
{
  "success": false,
  "error": {
    "code": "CONNECTION_FAILED",
    "message": "无法连接到服务器"
  }
}
```

## 6. 前端映射说明

- 连接管理页面：`src/pages/SettingsPage.tsx`
- 控制台页面：`src/pages/ConsolePage.tsx`
- 仪表盘页面：`src/pages/DashboardPage.tsx`
- 玩家管理页面：`src/pages/PlayersPage.tsx`
- 模拟数据集中：`src/services/mock`

## 7. 对接注意事项

- 连接成功后，返回的连接状态应驱动前端 `ConnectionStatus`。
- 自动重连由前端控制开关，建议后端提供断开原因便于提示。
- 控制台消息建议统一为 `ConsoleMessage` 格式，便于区分消息类型与颜色。
