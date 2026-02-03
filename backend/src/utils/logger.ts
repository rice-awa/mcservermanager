/**
 * 日志记录器工具
 */
import type { LogLevel } from '../types';

// 日志级别优先级
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ANSI 颜色代码
const COLORS = {
  reset: '\x1b[0m',
  debug: '\x1b[36m',  // 青色
  info: '\x1b[32m',   // 绿色
  warn: '\x1b[33m',   // 黄色
  error: '\x1b[31m',  // 红色
  time: '\x1b[90m',   // 灰色
  context: '\x1b[35m', // 紫色
};

// 当前日志级别
let currentLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) || 'info';

/**
 * 设置日志级别
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * 获取当前日志级别
 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

/**
 * 格式化时间戳
 */
function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 23);
}

/**
 * 格式化日志级别标签
 */
function formatLevel(level: LogLevel): string {
  const color = COLORS[level];
  const label = level.toUpperCase().padEnd(5);
  return `${color}${label}${COLORS.reset}`;
}

/**
 * 格式化上下文
 */
function formatContext(context?: string): string {
  if (!context) return '';
  return `${COLORS.context}[${context}]${COLORS.reset} `;
}

/**
 * 格式化数据对象
 */
function formatData(data?: unknown): string {
  if (data === undefined) return '';
  try {
    return '\n' + JSON.stringify(data, null, 2);
  } catch {
    return '\n[无法序列化的数据]';
  }
}

/**
 * 检查是否应该输出该级别的日志
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * 核心日志函数
 */
function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date();

  // 格式化输出
  const timeStr = `${COLORS.time}${formatTimestamp(timestamp)}${COLORS.reset}`;
  const levelStr = formatLevel(level);
  const contextStr = formatContext(context);
  const dataStr = formatData(data);

  const output = `${timeStr} ${levelStr} ${contextStr}${message}${dataStr}`;

  // 输出到控制台
  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }

  return;
}

/**
 * 创建带上下文的日志记录器
 */
export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', message, context, data),
    info: (message: string, data?: unknown) => log('info', message, context, data),
    warn: (message: string, data?: unknown) => log('warn', message, context, data),
    error: (message: string, data?: unknown) => log('error', message, context, data),
  };
}

// 默认日志记录器
export const logger = {
  debug: (message: string, data?: unknown) => log('debug', message, undefined, data),
  info: (message: string, data?: unknown) => log('info', message, undefined, data),
  warn: (message: string, data?: unknown) => log('warn', message, undefined, data),
  error: (message: string, data?: unknown) => log('error', message, undefined, data),
};

export default logger;
