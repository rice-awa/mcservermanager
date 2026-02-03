# JWT 登录/鉴权接口实现总结

## 实现内容

### 1. 新增文件

| 文件路径 | 说明 |
|---------|------|
| `backend/src/types/auth.ts` | JWT 认证类型定义 |
| `backend/src/services/auth.service.ts` | JWT 认证服务（Token 生成与验证） |
| `backend/src/middleware/auth.middleware.ts` | REST API Bearer Token 认证中间件 |
| `backend/src/middleware/socket-auth.middleware.ts` | Socket.io Socket Token 认证中间件 |
| `backend/src/routes/auth.routes.ts` | 认证 REST API 路由 |

### 2. 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `backend/src/types/index.ts` | 导出认证类型 |
| `backend/src/routes/index.ts` | 导出 authRoutes |
| `backend/src/index.ts` | 集成认证路由和 Socket 认证中间件 |
| `backend/package.json` | 添加 jsonwebtoken 依赖 |

### 3. API 接口

#### 3.1 POST /api/auth/login - 用户登录

```json
// 请求
{
  "username": "admin",
  "password": "admin123"
}

// 响应
{
  "success": true,
  "data": {
    "user": {
      "id": "user-001",
      "username": "admin",
      "role": "admin",
      "createdAt": "2026-02-03T..."
    },
    "tokens": {
      "accessToken": "eyJ...",
      "socketToken": "eyJ...",
      "expiresIn": 86400
    }
  }
}
```

#### 3.2 GET /api/auth/me - 获取当前用户

需要 `Authorization: Bearer <access_token>`

#### 3.3 POST /api/auth/refresh - 刷新 Token

```json
// 请求
{
  "socketToken": "eyJ..."
}
```

#### 3.4 POST /api/auth/logout - 用户登出

需要 `Authorization: Bearer <access_token>`

### 4. Socket.io 认证

支持两种认证方式：

1. **Query 参数**：`ws://host:port?token=<socket_token>`
2. **Auth 事件**：连接后发送 `{ type: 'auth', payload: { token: '<socket_token>' } }`

### 5. 演示账号

| 用户名 | 密码 | 角色 |
|-------|------|-----|
| admin | admin123 | admin |
| user | user123 | user |

### 6. 环境变量

| 变量 | 默认值 | 说明 |
|-----|-------|------|
| JWT_SECRET | your-super-secret-jwt-key-change-in-production | JWT 密钥 |
| JWT_EXPIRES_IN | 24h | Access Token 过期时间 |
| SOCKET_TOKEN_EXPIRES_IN | 7d | Socket Token 过期时间 |

## 使用示例

### 前端登录

```typescript
const response = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});
const { data } = await response.json();
localStorage.setItem('accessToken', data.tokens.accessToken);
localStorage.setItem('socketToken', data.tokens.socketToken);
```

### 后续请求携带 Token

```typescript
fetch('http://localhost:3001/api/configs', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});
```

### WebSocket 连接

```typescript
const socket = io('http://localhost:3001', {
  auth: {
    token: localStorage.getItem('socketToken')
  }
});
```
