# Minecraft 服务器管理器安全评估报告

## 一、评估概述

本报告针对 Minecraft 服务器管理器项目进行全面的安全性评估，重点关注 RCON 协议的安全性问题以及项目中存在的其他潜在安全风险。评估范围涵盖前端界面、后端服务、数据传输机制以及配置存储方式等各个方面。

项目的核心功能是通过 RCON 协议远程管理 Minecraft Java 版服务器，实现服务器连接、命令执行、状态监控和玩家管理等功能。由于 RCON 协议本身的设计特性以及项目在实现过程中的一些安全考量缺失，整体安全状况存在较多需要改进的地方。

## 二、RCON 协议安全分析

### 2.1 协议本身的安全缺陷

RCON（Remote Console Protocol）是一种允许远程执行服务端命令的网络协议。根据 Minecraft Wiki 的官方文档说明，RCON 协议存在一个根本性的安全缺陷：**所有数据都以明文形式传输，包括认证过程中使用的密码**。

这意味着在网络传输过程中，任何能够截获网络流量的攻击者都可以轻松获取 RCON 密码，从而获得对 Minecraft 服务器的完全控制权限。

### 2.2 项目中 RCON 的实现方式

项目使用 `rcon-client` 库（版本 4.2.5）来实现 RCON 连接功能。在 `backend/src/services/rcon.service.ts` 中：

```typescript
const rcon = new Rcon({
  host,
  port: rconPort,
  password: rconPassword,  // 密码明文传输
  timeout: this.timeout,
});
```

### 2.3 RCON 暴露风险

将 RCON 端口暴露于公网中具有极高的危险性。攻击者可以：
- 进行网络扫描发现开放的 RCON 服务
- 暴力破解 RCON 密码
- 执行任意服务端命令（如 `op`、`give`、`tp` 等）

## 三、其他安全问题

### 3.1 认证与授权机制缺失

在 `backend/src/handlers/socket.handler.ts` 中，所有 Socket 事件处理函数都没有进行身份验证：
- `server:connect` - 无验证即可连接服务器
- `console:command` - 无验证即可执行任意命令
- `servers:add/update/delete` - 无验证即可修改配置

### 3.2 配置存储安全性不足

在 `backend/src/services/config.service.ts:12` 中，配置存储在内存中：
```typescript
private configs: Map<string, ServerConfig> = new Map();
```
- 密码以明文形式存储在内存中
- 缺少持久化加密机制

### 3.3 WebSocket 安全问题

- 缺少 WSS 加密（`socket.handler.ts`）
- CORS 配置较宽松（`config/index.ts:13-14`）

### 3.4 缺少速率限制

在 `rcon.service.ts` 中没有实现速率限制，可能导致：
- 暴力破解攻击
- DoS 攻击

### 3.5 日志记录不完善

- 缺少敏感操作审计日志
- 日志可能包含敏感信息

## 四、风险等级评估

| 问题 | 风险等级 |
|------|----------|
| RCON 明文传输密码 | 高 |
| 缺少用户认证机制 | 高 |
| WebSocket 无身份验证 | 高 |
| 配置存储安全性不足 | 中 |
| 缺少速率限制 | 中 |
| 日志审计不完善 | 中 |
| CORS 配置宽松 | 低 |

## 五、安全建议

### 5.1 缓解 RCON 明文传输风险

1. **VPN 或 SSH 隧道**：建立加密通道保护 RCON 通信
2. **网络隔离**：配置防火墙仅允许受信任 IP 访问 RCON 端口
3. **RCON 代理**：实现 SSL/TLS 加密层

### 5.2 增强认证与授权机制

- 实现基于令牌的身份验证（如 JWT）
- 实施基于角色的访问控制（RBAC）
- 对敏感操作进行权限验证

### 5.3 改进配置存储安全

- 使用 AES-256 加密存储密码
- 实施配置访问控制
- 考虑使用密钥管理工具

### 5.4 加强网络安全配置

- 强制使用 WSS 协议
- 配置严格的 CORS 策略
- 实施速率限制

### 5.5 完善审计与监控

- 记录所有敏感操作
- 对日志敏感信息脱敏
- 集成安全监控告警

## 六、总结

该项目在当前状态下**不适合直接部署到生产环境**，尤其是在公网可访问的场景。必须通过以下最低安全要求：

1. 使用 VPN 或 SSH 隧道保护 RCON 通信
2. 实现 WebSocket 身份验证
3. 配置防火墙限制 RCON 端口访问范围

建议仅在受信任的内网环境中使用该项目。
