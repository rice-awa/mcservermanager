# Spark API 集成实现方案

## 概述

重写 `backend/src/services/spark.service.ts`，实现双重数据获取策略：
- **主要方案（C）**：通过 RCON 执行 spark 命令，解析文本输出
- **备选方案（B）**：通过 `/spark health --upload` 获取 URL，拉取 raw JSON 数据

## 实现步骤

### 1. 定义数据类型 (`backend/src/types/index.ts`)

新增 Spark 相关类型定义：

```typescript
// Spark TPS 统计窗口
interface SparkTPSStats {
  last5s: number;
  last10s: number;
  last1m: number;
  last5m: number;
  last15m: number;
}

// Spark MSPT 统计
interface SparkMSPTStats {
  min: number;
  median: number;
  percentile95: number;
  max: number;
}

// Spark CPU 统计
interface SparkCPUStats {
  process: { last10s: number; last1m: number; last15m: number };
  system: { last10s: number; last1m: number; last15m: number };
}

// Spark 内存统计
interface SparkMemoryStats {
  used: number;
  allocated: number;
  max: number;
}

// 完整 Spark 健康报告
interface SparkHealthReport {
  tps: SparkTPSStats;
  mspt: SparkMSPTStats;
  cpu: SparkCPUStats;
  memory: SparkMemoryStats;
  disk?: { used: number; total: number };
  timestamp: number;
}
```

### 2. 重写 SparkService (`backend/src/services/spark.service.ts`)

核心实现包含以下模块：

#### 2.1 RCON 命令解析器（方案 C）

```typescript
class SparkService {
  constructor(private rconService: RconService) {}

  // 通过 RCON 获取 TPS 数据
  async getTPSViaRcon(serverId: string): Promise<SparkTPSStats | null>

  // 通过 RCON 获取健康报告
  async getHealthViaRcon(serverId: string): Promise<SparkHealthReport | null>

  // 解析 spark tps 命令输出
  private parseTPSOutput(output: string): SparkTPSStats | null

  // 解析 spark health 命令输出
  private parseHealthOutput(output: string): Partial<SparkHealthReport> | null
}
```

**解析逻辑要点**：
- 移除 Minecraft 颜色代码（`§[0-9a-fk-or]`）
- 使用正则匹配 TPS/MSPT/CPU/Memory 数值
- 处理可能的解析失败，返回 null

#### 2.2 Health Report API（方案 B）

```typescript
class SparkService {
  // 通过上传获取 health report URL
  async uploadHealthReport(serverId: string): Promise<string | null>

  // 通过 URL 获取 raw JSON 数据
  async fetchHealthReportJson(reportUrl: string): Promise<SparkHealthReport | null>

  // 从 spark viewer URL 提取报告 ID
  private extractReportId(url: string): string | null
}
```

**API 调用流程**：
1. RCON 执行 `/spark health --upload`
2. 从输出中提取 `https://spark.lucko.me/{id}` URL
3. 请求 `https://spark.lucko.me/{id}?raw=1` 获取 JSON
4. 解析 JSON 转换为 `SparkHealthReport`

#### 2.3 统一获取接口

```typescript
class SparkService {
  // 统一获取方法（优先 RCON，失败时用 API）
  async getHealth(serverId: string): Promise<SparkHealthReport | null> {
    // 1. 尝试方案 C
    const rconResult = await this.getHealthViaRcon(serverId);
    if (rconResult) return rconResult;

    // 2. 降级到方案 B
    const reportUrl = await this.uploadHealthReport(serverId);
    if (reportUrl) {
      return this.fetchHealthReportJson(reportUrl);
    }

    return null;
  }
}
```

### 3. 集成到 StatsService (`backend/src/services/stats.service.ts`)

修改 `collectStats` 方法，调用 SparkService 获取真实数据：

```typescript
private async collectStats(serverId: string): Promise<void> {
  const health = await this.sparkService.getHealth(serverId);
  
  if (health) {
    const stats: ServerStats = {
      tps: health.tps.last1m,
      cpu: health.cpu.process.last1m,
      memory: {
        used: health.memory.used,
        max: health.memory.max,
        allocated: health.memory.allocated,
      },
      // ... 其他字段通过 RCON list 命令获取
    };
    this.addToHistory(serverId, stats);
  }
}
```

### 4. 安装 HTTP 客户端依赖

方案 B 需要发起 HTTP 请求，安装 axios：

```bash
cd backend
npm install axios
```

### 5. 配置更新 (`backend/src/config/index.ts`)

添加 Spark 相关配置：

```typescript
spark: {
  preferRcon: true,           // 优先使用 RCON
  reportCacheTTL: 30000,      // 报告缓存 30 秒
  timeout: 10000,             // API 请求超时
}
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/src/types/index.ts` | 修改 | 新增 Spark 类型定义 |
| `backend/src/services/spark.service.ts` | 重写 | 实现双重获取策略 |
| `backend/src/services/stats.service.ts` | 修改 | 集成 SparkService |
| `backend/src/services/index.ts` | 修改 | 更新导出 |
| `backend/src/config/index.ts` | 修改 | 添加 Spark 配置 |
| `backend/package.json` | 修改 | 添加 axios 依赖 |

## 测试验证

1. 单独测试 RCON 命令解析：`spark tps` / `spark health`
2. 测试 API 备选方案：`spark health --upload`
3. 验证 StatsService 实时采集功能
4. 检查前端仪表盘数据展示

## 注意事项

- spark 命令输出包含 Minecraft 颜色代码，需要先清理
- 方案 B 的上传功能有速率限制，不宜频繁调用
- CPU/内存数据单位需与前端约定一致（百分比/MB）