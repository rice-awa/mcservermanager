# Spark URL 提取问题修复总结

## 问题描述

执行 `spark health --upload` 命令后，无法从 RCON 响应中获取健康报告 URL。日志监听器（LogMonitorService）在 Windows 上无法捕获 Minecraft 服务器日志文件的新内容。

## 问题根因

### 1. RCON 返回空响应

Spark 插件的命令是**异步执行**的，运行在独立的线程池中，输出直接写入到**服务器日志文件**，而不是通过 RCON 同步返回。

### 2. 日志监听器在 Windows 上失效

**核心问题**：在 Windows 上，`fs.fstatSync()` 可能受到文件系统缓存的影响，返回的文件大小不是最新的。

- Minecraft 服务器写入日志后，Windows 可能会缓存文件元数据
- `fstatSync()` 返回的文件大小是缓存值，不是实际大小
- 轮询检测不到文件大小变化，因此不会读取新内容

## 解决方案

在 `log-monitor.service.ts` 的 `poll()` 方法中添加 `fs.fsyncSync()` 调用，强制刷新文件元数据：

### 修改内容

**文件**: `backend/src/services/log-monitor.service.ts`

1. 在检查文件大小前强制刷新元数据：
```typescript
// 强制刷新文件元数据（解决 Windows 文件系统缓存问题）
fs.fsyncSync(this.fd);

const stats = fs.fstatSync(this.fd);
const newSize = stats.size;
```

2. 在读取缓冲区前再次刷新：
```typescript
// 再次刷新确保读取到最新数据
fs.fsyncSync(this.fd);

const buffer = Buffer.alloc(bytesToRead);
fs.readSync(this.fd, buffer, 0, bytesToRead, this.position);
```

## 验证步骤

1. 运行日志监听器测试：
```bash
npx ts-node test-log-monitor-simple.ts
```

2. 在 Minecraft 服务器中执行命令，观察日志是否被正确捕获

3. 运行完整的 Spark Web API 测试：
```bash
npx ts-node test-spark-webapi.ts localhost 25575 your_password "D:\MCTESTSERVER\1.21.11"
```

## 替代方案（如果问题持续）

如果 `fs.fsyncSync()` 仍无法解决问题，可以考虑：

1. **使用 `fs.watch()` API** - 监听文件变化事件而非轮询
2. **直接读取日志文件** - 执行命令后直接读取最后 N 行搜索 URL
3. **使用第三方库** - 如 `tail-file` 或 `always-tail`

## 相关文件

- `backend/src/services/log-monitor.service.ts` - 日志监听服务（已修复）
- `backend/src/services/spark.service.ts` - Spark 服务
- `backend/test-log-monitor-simple.ts` - 日志监听器测试
- `backend/test-spark-webapi.ts` - Spark Web API 测试

## 修复日期

2026-02-03
