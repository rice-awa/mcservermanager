/**
 * 应用配置
 */
import type { AppConfig } from '../types';

// 默认配置
const defaultConfig: AppConfig = {
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  },
  rcon: {
    timeout: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  stats: {
    updateInterval: 5000,
    historySize: 100,
  },
  spark: {
    preferRcon: true,           // 优先使用 RCON 方案
    reportCacheTTL: 30000,      // 报告缓存 30 秒
    timeout: 10000,             // API 请求超时 10 秒
  },
};

/**
 * 获取环境变量值
 */
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * 获取环境变量数字值
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 获取环境变量数组值
 */
function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.split(',').map((s) => s.trim());
}

/**
 * 加载配置
 */
export function loadConfig(): AppConfig {
  return {
    server: {
      port: getEnvNumber('PORT', defaultConfig.server.port),
      host: getEnv('HOST', defaultConfig.server.host),
    },
    cors: {
      origin: getEnvArray('CORS_ORIGIN', defaultConfig.cors.origin as string[]),
      credentials: true,
    },
    rcon: {
      timeout: getEnvNumber('RCON_TIMEOUT', defaultConfig.rcon.timeout),
      retryAttempts: getEnvNumber('RCON_RETRY_ATTEMPTS', defaultConfig.rcon.retryAttempts),
      retryDelay: getEnvNumber('RCON_RETRY_DELAY', defaultConfig.rcon.retryDelay),
    },
    stats: {
      updateInterval: getEnvNumber('STATS_UPDATE_INTERVAL', defaultConfig.stats.updateInterval),
      historySize: getEnvNumber('STATS_HISTORY_SIZE', defaultConfig.stats.historySize),
    },
    spark: {
      preferRcon: getEnv('SPARK_PREFER_RCON', 'true') === 'true',
      reportCacheTTL: getEnvNumber('SPARK_REPORT_CACHE_TTL', defaultConfig.spark.reportCacheTTL),
      timeout: getEnvNumber('SPARK_TIMEOUT', defaultConfig.spark.timeout),
    },
  };
}

// 导出默认配置供测试使用
export { defaultConfig };
