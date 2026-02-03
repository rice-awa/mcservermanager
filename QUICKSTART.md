# 快速启动指南

本指南帮助你快速启动前后端集成后的 MC Server Manager。

## 前置条件

- Node.js 18+ 已安装
- 一个运行中的 Minecraft 服务器(支持 RCON 和 Spark Mod)

## 1. 启动后端服务

```bash
# 进入后端目录
cd backend

# 安装依赖(首次运行)
npm install

# 启动开发服务器
npm run dev
```

后端服务将在 http://localhost:3001 启动

验证后端服务:
- 访问 http://localhost:3001/health (健康检查)
- 访问 http://localhost:3001/api (API 信息)

## 2. 启动前端服务

```bash
# 在项目根目录
npm install  # 首次运行

# 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:5173 启动

## 3. 配置 Minecraft 服务器

### 3.1 启用 RCON

在 Minecraft 服务器的 `server.properties` 中配置:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=your-password
```

### 3.2 安装 Spark Mod

1. 下载 Spark: https://spark.lucko.me/download
2. 将 jar 文件放入服务器的 `mods` 或 `plugins` 目录
3. 重启服务器

## 4. 添加服务器配置

### 方式 1: 使用演示页面

1. 访问 http://localhost:5173 (可能需要在路由中添加演示页面)
2. 点击"加载配置列表"测试 API 连接
3. 点击"选择"按钮选择一个服务器
4. 测试各项功能

### 方式 2: 使用设置页面

1. 访问设置页面
2. 点击"新建连接"
3. 填写服务器信息:
   - 名称: 例如"我的服务器"
   - 主机: 127.0.0.1(本地) 或服务器 IP
   - 端口: 25575(RCON 端口)
   - 密码: RCON 密码
   - 超时: 5000(毫秒)
   - Spark API: http://服务器IP:Spark端口/spark
4. 点击"测试连接"验证配置
5. 保存配置

## 5. 测试功能

### 测试 REST API

打开浏览器开发者工具,查看网络请求:

1. **配置列表**
   ```
   GET http://localhost:3001/api/configs
   ```

2. **服务器状态**
   ```
   GET http://localhost:3001/api/stats?serverId=xxx
   ```

3. **玩家列表**
   ```
   GET http://localhost:3001/api/players?serverId=xxx
   ```

### 测试 WebSocket

1. 打开浏览器控制台
2. 查看 WebSocket 连接日志
3. 应该看到类似的日志:
   ```
   [SocketService] Connecting to: http://localhost:3001
   [SocketService] Connected, socket ID: xxx
   ```

### 测试控制台命令

1. 访问控制台页面
2. 输入命令,例如 `list`
3. 应该看到服务器返回的玩家列表

### 测试实时数据

1. 访问仪表盘页面
2. 应该看到 TPS、CPU、内存等数据
3. 数据应该实时更新

## 6. 故障排查

### 后端无法启动

- 检查端口 3001 是否被占用
- 查看控制台错误信息
- 确认依赖已正确安装

### 前端无法连接后端

- 检查 `.env.local` 文件配置
- 确认后端服务正在运行
- 检查浏览器控制台的网络请求

### RCON 连接失败

- 确认 Minecraft 服务器已启用 RCON
- 检查 RCON 端口和密码是否正确
- 确认防火墙允许 RCON 端口

### Spark 数据获取失败

- 确认 Spark Mod 已正确安装
- 检查 Spark API URL 是否正确
- 确认服务器支持 Spark 的 Web API

### WebSocket 连接失败

- 检查防火墙设置
- 确认后端 WebSocket 服务正常
- 查看浏览器控制台错误信息

## 7. 开发工具

### 后端日志

后端使用自定义日志系统,日志级别可通过环境变量设置:

```bash
LOG_LEVEL=debug npm run dev
```

### API 测试

可以使用以下工具测试 API:
- Postman
- curl
- Thunder Client (VS Code 扩展)

示例:
```bash
# 获取配置列表
curl http://localhost:3001/api/configs

# 获取服务器状态
curl http://localhost:3001/api/stats?serverId=server-1

# 测试连接
curl -X POST http://localhost:3001/api/configs/server-1/test
```

### WebSocket 测试

可以使用 Socket.IO 客户端测试:

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('server:connect', { serverId: 'server-1' });
});

socket.on('statsUpdate', (data) => {
  console.log('Stats:', data);
});
```

## 8. 生产部署

### 构建前端

```bash
npm run build
```

构建产物在 `dist` 目录。

### 构建后端

```bash
cd backend
npm run build
npm start
```

### 环境变量

生产环境建议配置:

**后端 (.env)**
```env
PORT=3001
HOST=0.0.0.0
JWT_SECRET=your-super-secret-jwt-key
LOG_LEVEL=info
CORS_ORIGIN=https://your-domain.com
```

**前端 (.env.production)**
```env
VITE_API_BASE_URL=https://your-api-domain.com
VITE_WS_URL=https://your-api-domain.com
```

## 9. 更多信息

- [后端对接文档](backend/backend-integration.md)
- [前端集成指南](FRONTEND_INTEGRATION_GUIDE.md)
- [集成总结](FRONTEND_INTEGRATION_SUMMARY.md)
- [API 服务源码](src/services/api.service.ts)
- [WebSocket 服务源码](src/services/socket.service.ts)

## 10. 支持

如果遇到问题:
1. 查看相关文档
2. 检查浏览器控制台和后端日志
3. 参考演示页面的实现
4. 查看 GitHub Issues

祝你使用愉快! 🎉
