# 功能测试快速参考

## 🚀 5 分钟快速开始

### 1️⃣ 第一个 PowerShell 窗口：启动后端

```powershell
cd E:\Python_JavaScript\mcservermanager\backend
npm run dev
```

等待看到 `服务器启动成功`

### 2️⃣ 第二个 PowerShell 窗口：添加服务器配置

```powershell
cd E:\Python_JavaScript\mcservermanager\backend
.\add-test-config.ps1
```

按照提示输入：
- 服务器名称: 按 Enter 使用默认值
- 服务器地址: `127.0.0.1` (本地) 或服务器 IP
- RCON 端口: `25575` (默认)
- RCON 密码: 你在 server.properties 中设置的密码
- 连接超时: 按 Enter 使用默认值
- Spark API: 按 Enter 跳过 (可选)

### 3️⃣ 第二个窗口：运行测试

```powershell
npm run test:functional
```

## 📋 命令速查表

```powershell
# 启动后端
npm run dev

# 添加服务器配置
.\add-test-config.ps1

# 查看已有配置
curl http://localhost:3001/api/configs -UseBasicParsing

# 运行所有测试 (推荐)
npm run test:functional

# 运行单个测试
npm run test:connection    # 连接测试
npm run test:console       # 控制台测试
npm run test:dashboard     # 仪表盘测试

# 快速测试向导
.\test-quick.ps1
```

## ✅ 成功的标志

✓ 后端启动成功：
```
2026-02-03 09:44:00.887 INFO  [App] 服务器启动成功
2026-02-03 09:44:00.887 INFO  [App] HTTP: http://0.0.0.0:3001
```

✓ 配置添加成功：
```
✓ 配置添加成功！
  服务器名称: 主世界服务器
  地址: 127.0.0.1
  RCON 端口: 25575
```

✓ 测试通过：
```
✓ 测试 RCON 连接
  消息: RCON 连接成功
  
✓ 测试 WebSocket 连接
  消息: WebSocket 连接成功
  
✓ 测试断线重连
  消息: 成功进行断线重连
```

✓ 所有测试完成：
```
╔════════════════════════════════════════╗
║         测试总体结果摘要              ║
╚════════════════════════════════════════╝

✓ 连接测试      通过: 4/4    耗时: 1969ms
✓ 控制台测试    通过: 3/3    耗时: 3635ms
✓ 仪表盘测试    通过: 4/4    耗时: 4391ms

🎉 所有测试都通过了！
```

## ❌ 常见问题速解

### 问题: `后端服务未运行`

**解决:** 在新的 PowerShell 窗口运行：
```powershell
npm run dev
```

### 问题: `未找到可用的服务器配置`

**解决:** 运行配置脚本：
```powershell
.\add-test-config.ps1
```

### 问题: `RCON 连接失败`

**检查清单:**
- [ ] Minecraft 服务器正在运行
- [ ] `server.properties` 中 `enable-rcon=true`
- [ ] RCON 密码正确
- [ ] 防火墙允许 25575 端口

### 问题: `WebSocket 连接失败`

**检查清单:**
- [ ] 后端服务正在运行 (npm run dev)
- [ ] 端口 3001 未被占用
- [ ] 防火墙允许 3001 端口

## 📊 预期运行时间

| 测试项 | 耗时 |
|--------|------|
| 连接测试 | 2-10 秒 |
| 控制台测试 | 3-20 秒 |
| 仪表盘测试 | 2-20 秒 |
| **总计** | **7-50 秒** |

*实际耗时取决于网络延迟和 Minecraft 服务器响应速度*

## 📚 详细文档

- [完整测试设置指南](TEST_SETUP_GUIDE.md)
- [功能测试指南](FUNCTIONAL_TESTING_GUIDE.md)
- [测试总结](TESTING_SUMMARY.md)
- [后端对接文档](backend/backend-integration.md)

## 🎯 下一步

✅ 测试通过后：
1. 检查所有 11 个测试都通过
2. 查看 [性能优化步骤 57-59](backend/todolist.md)
3. 准备部署到生产环境

---

**需要完整说明？** 查看 [TEST_SETUP_GUIDE.md](TEST_SETUP_GUIDE.md)
