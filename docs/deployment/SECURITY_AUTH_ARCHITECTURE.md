# 前后端通信加密与鉴权方案

## 一、方案概述

本方案旨在解决 Minecraft 服务器管理器在公网部署时的安全问题，通过 Cloudflare 服务实现零配置的 HTTPS 加密通信，并引入 JWT 令牌认证机制确保 API 安全。

### 1.1 核心目标

- **传输加密**：确保前后端通信全程 HTTPS 加密，防止中间人攻击
- **身份验证**：实现用户登录鉴权，防止未授权访问
- **最小改动**：尽量复用现有代码结构，降低改造成本
- **免费方案**：使用 Cloudflare 免费服务，无需额外服务器成本

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                              用户浏览器                              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS (wss://)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare 全球 CDN                           │
│  • 免费 SSL/TLS 证书                                                 │
│  • DDoS 防护                                                        │
│  • 页面缓存加速                                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Cloudflare Tunnel
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      云服务器 (部署后端服务)                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 Node.js 后端应用                              │   │
│  │  • Express HTTP 服务                                         │   │
│  │  • Socket.IO WebSocket 服务                                  │   │
│  │  • JWT 认证中间件                                            │   │
│  │  • RCON 服务                                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Minecraft Java 版服务器                          │   │
│  │  • RCON 协议 (25575 端口)                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 技术选型

| 组件 | 方案 | 成本 | 复杂度 |
|------|------|------|--------|
| CDN + HTTPS | Cloudflare Pages + Tunnel | 免费 | 低 |
| 身份认证 | JWT (JSON Web Token) | 免费 | 低 |
| 前端部署 | Cloudflare Pages | 免费 | 低 |
| 后端部署 | 云服务器 + cloudflared | 免费 | 低 |
| SSL 证书 | Cloudflare 自动管理 | 免费 | 无 |

## 二、Cloudflare 部署方案

### 2.1 方案一：Cloudflare Pages（推荐前端）

适用于纯静态前端应用，无需服务器端渲染。

#### 部署步骤

**1. 连接 GitHub 仓库**

- 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
- 进入 Pages → Connect to Git
- 选择 mcservermanager 仓库
- 设置构建设置：
  ```
  Build command: npm run build
  Build output directory: dist
  ```

**2. 配置自定义域名**

- 在 Pages → 自定义域中添加你的域名
- Cloudflare 自动签发 SSL 证书
- 开启 "Always Use HTTPS"

**3. 配置 Worker（如需鉴权）**

```javascript
// Cloudflare Worker 实现简单鉴权
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    // 验证 JWT 令牌
    if (!token || !verifyToken(token, env.JWT_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 代理到后端服务器
    return fetch(env.BACKEND_URL, request);
  },
};
```

### 2.2 方案二：Cloudflare Tunnel（推荐整体）

适用于前后端整体部署，零配置内网穿透。

#### 2.2.1 安装 cloudflared

**Linux (Ubuntu/Debian)**

```bash
# 下载安装包
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# 验证安装
cloudflared --version
```

**Linux (systemd 服务)**

```bash
# 创建服务文件
sudo nano /etc/systemd/system/cloudflared.service
```

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=www-data
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:3001
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

**Windows**

```powershell
# 下载
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"

# 运行
.\cloudflared.exe tunnel --url http://localhost:3001
```

#### 2.2.2 验证 Tunnel 连接

```bash
# 查看 Tunnel UUID
cloudflared tunnel list

# 查看实时日志
journalctl -u cloudflared -f
```

访问 `https://your-domain.trycloudflare.com` 应能正常显示应用。

### 2.3 方案对比

| 特性 | Cloudflare Pages | Cloudflare Tunnel |
|------|------------------|-------------------|
| SSL 证书 | 自动管理 | 自动管理 |
| DDoS 防护 | 内置 | 内置 |
| 延迟 | 较低（边缘节点） | 取决于服务器位置 |
| 前端适用 | ✅ 最佳 | ✅ 可用 |
| 后端适用 | ❌ 不支持 | ✅ 最佳 |
| WebSocket | ❌ 有限支持 | ✅ 完全支持 |
| 成本 | 免费 | 免费 |

### 2.4 推荐方案

- **纯前端项目**：使用 Cloudflare Pages 部署前端
- **前后端整体**：使用 cloudflared Tunnel 暴露后端
- **混合方案**：前端 Pages + Tunnel 暴露后端 API

## 三、JWT 认证方案

### 3.1 认证流程

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│   前端      │     │ Cloudflare │     │  后端 API   │     │  令牌存储   │
└─────┬──────┘     └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
      │                  │                  │                  │
      │  1. 登录请求      │                  │                  │
      │ ────────────────>│                  │                  │
      │                  │ ────────────────>│                  │
      │                  │                  │  2. 验证凭据       │
      │                  │                  │ ────────────────> │
      │                  │                  │                  │
      │                  │                  │  3. 生成 JWT      │
      │                  │                  │ <─────────────── │
      │                  │                  │                  │
      │  4. 返回令牌      │                  │                  │
      │ <─────────────── │                  │                  │
      │                  │                  │                  │
      │  5. 后续请求      │                  │                  │
      │ ────────────────>│                  │                  │
      │                  │ ────────────────>│                  │
      │                  │                  │  6. 验证令牌       │
      │                  │                  │ <─────────────── │
      │                  │                  │                  │
      │  7. 返回数据      │                  │                  │
      │ <─────────────── │                  │                  │
```

### 3.2 JWT 令牌结构

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "username": "admin",
    "role": "admin",
    "iat": 1704067200,
    "exp": 1704153600,
    "permissions": [
      "servers:read",
      "servers:write",
      "commands:execute"
    ]
  }
}
```

### 3.3 后端实现要点

#### 3.3.1 依赖安装

```bash
cd backend
npm install jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
```

#### 3.3.2 核心模块

**auth.service.ts**

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  permissions: string[];
}

class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn = '24h';

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key';
  }

  // 验证密码
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // 生成密码哈希
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // 生成 JWT 令牌
  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  // 验证 JWT 令牌
  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch {
      return null;
    }
  }

  // 从请求头提取令牌
  extractToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

export const authService = new AuthService();
```

**auth.middleware.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = authService.extractToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '未提供认证令牌',
      },
    });
    return;
  }

  const payload = authService.verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: '无效或已过期的令牌',
      },
    });
    return;
  }

  // 将用户信息附加到请求对象
  (req as any).user = payload;
  next();
}

// Socket.IO 认证中间件
export function socketAuthMiddleware(socket: any, next: any) {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  const payload = authService.verifyToken(token);

  if (!payload) {
    return next(new Error('Authentication error: Invalid token'));
  }

  socket.user = payload;
  next();
}
```

### 3.4 前端实现要点

#### 3.4.1 登录表单

```typescript
// 使用现有的 SettingsPage.tsx 改造

interface LoginCredentials {
  username: string;
  password: string;
}

async function login(credentials: LoginCredentials): Promise<{ token: string }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error('登录失败');
  }

  return response.json();
}

// 存储令牌
localStorage.setItem('auth_token', token);

// 请求时携带令牌
function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
}
```

#### 3.4.2 WebSocket 连接

```typescript
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    // Cloudflare Tunnel 域名
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://your-app.trycloudflare.com';
    
    this.socket = io(serverUrl, {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket 已连接');
    });

    this.socket.on('connect_error', (error) => {
      console.error('连接错误:', error.message);
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
```

### 3.5 默认账户配置

由于目前缺少数据库，建议使用环境变量配置默认管理员账户：

```bash
# .env 文件
JWT_SECRET=your-super-secret-key-change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password_change_this
```

## 四、部署检查清单

### 4.1 部署前准备

- [ ] 准备域名并完成 Cloudflare 解析
- [ ] 安装 Node.js 18+ 和 npm
- [ ] 克隆代码仓库到服务器
- [ ] 安装依赖：`npm install`
- [ ] 构建项目：`npm run build`

### 4.2 安全配置

- [ ] 生成强 JWT_SECRET（至少 32 位随机字符串）
- [ ] 修改默认管理员密码
- [ ] 启用 Cloudflare Always Use HTTPS
- [ ] 配置 Cloudflare 防火墙规则（可选）

### 4.3 部署步骤

1. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件
```

2. **启动后端服务**

```bash
# 方式一：直接运行
npm run start

# 方式二：使用 PM2（推荐）
npm install -g pm2
pm2 start npm --name "mcservermanager" -- run start

# 方式三：Docker
docker-compose up -d
```

3. **启动 Cloudflare Tunnel**

```bash
cloudflared tunnel --url http://localhost:3001
```

4. **验证部署**

- 访问 `https://your-domain.trycloudflare.com`
- 确认 HTTPS 证书有效
- 测试登录功能
- 测试 WebSocket 连接

### 4.4 监控与维护

```bash
# 查看 PM2 日志
pm2 logs mcservermanager

# 查看 Tunnel 状态
cloudflared tunnel list

# 重启服务
pm2 restart mcservermanager
```

## 五、常见问题

### Q1: Cloudflare Tunnel 和 Pages 可以同时使用吗？

**可以**。将前端部署到 Cloudflare Pages，后端通过 Tunnel 暴露。配置 Pages 的 Functions 代理到 Tunnel 域名即可。

### Q2: JWT 令牌过期怎么办？

前端检测到 401 错误时，跳转到登录页面重新获取令牌。建议实现令牌自动刷新机制。

### Q3: 如何限制只有特定用户能访问？

在 Cloudflare Dashboard → Pages → Functions 中添加 IP 访问规则，或使用 Cloudflare Access（需付费）。

### Q4: WebSocket 连接不稳定？

Cloudflare 免费版对 WebSocket 有一定限制。如遇到问题：
- 尝试重连机制
- 考虑使用付费版 Cloudflare 或自建代理

### Q5: 是否需要 HTTPS 证书？

**不需要**。Cloudflare 自动提供 SSL/TLS，服务器端使用 HTTP 即可（与 Tunnel 通信）。

## 六、总结

本方案提供了一套完整的低成本安全部署方案：

1. **传输加密**：Cloudflare 自动 HTTPS，无需手动配置证书
2. **身份认证**：JWT 令牌机制，防止未授权访问
3. **零成本**：所有服务均可使用免费版本
4. **快速部署**：30 分钟内完成从开发到生产环境的部署

通过本方案，即使 RCON 协议本身是明文传输，攻击者也无法直接访问到 RCON 端口，大大降低了安全风险。
