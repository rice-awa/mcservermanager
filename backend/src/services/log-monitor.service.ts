/**
 * 日志监听服务
 * 通过监听 Minecraft 服务器日志文件来捕获 Spark 命令输出
 */
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { LogLine, LogMonitorConfig } from '../types';
import { createLogger } from '../utils/logger';
import { loadConfig } from '../config';

const logger = createLogger('LogMonitorService');
const appConfig = loadConfig();

/**
 * 日志监听器（每个服务器一个实例）
 */
class LogMonitor extends EventEmitter {
  private fd: number | null = null;
  private position: number = 0;
  private timer: NodeJS.Timeout | null = null;
  private buffer: string = '';

  constructor(
    private logFilePath: string,
    private config: LogMonitorConfig
  ) {
    super();
  }

  /**
   * 启动监听
   */
  async start(): Promise<void> {
    try {
      // 打开日志文件
      this.fd = fs.openSync(this.logFilePath, 'r');
      
      // 跳到文件末尾（只读取新内容）
      const stats = fs.fstatSync(this.fd);
      this.position = stats.size;
      
      logger.info(`开始监听日志文件: ${this.logFilePath}`);
      
      // 启动轮询
      this.timer = setInterval(() => this.poll(), this.config.pollInterval);
    } catch (error) {
      logger.error(`无法打开日志文件: ${this.logFilePath}`, error);
      throw error;
    }
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
    
    logger.info(`停止监听日志文件: ${this.logFilePath}`);
  }

  /**
   * 轮询读取新内容
   */
  private poll(): void {
    if (this.fd === null) return;

    try {
      const stats = fs.fstatSync(this.fd);
      const newSize = stats.size;

      // 文件被截断（日志轮转）
      if (newSize < this.position) {
        logger.info('检测到日志轮转，重置位置');
        this.position = 0;
      }

      // 没有新内容
      if (newSize === this.position) {
        return;
      }

      // 读取新内容
      const bytesToRead = newSize - this.position;
      const buffer = Buffer.alloc(bytesToRead);
      fs.readSync(this.fd, buffer, 0, bytesToRead, this.position);
      this.position = newSize;

      // 解码并处理
      const content = buffer.toString(this.config.encoding as BufferEncoding);
      this.processContent(content);
    } catch (error) {
      logger.error('轮询日志文件出错', error);
    }
  }

  /**
   * 处理读取到的内容
   */
  private processContent(content: string): void {
    // 合并缓冲区
    this.buffer += content;

    // 按行分割
    const lines = this.buffer.split('\n');
    
    // 保留最后一行（可能不完整）
    this.buffer = lines.pop() || '';

    // 处理完整的行
    for (const line of lines) {
      if (line.trim()) {
        const parsed = this.parseLine(line);
        if (parsed) {
          this.emit('line', parsed);
        }
      }
    }
  }

  /**
   * 解析日志行
   * 格式: [HH:MM:SS] [Thread/LEVEL]: Message
   * 示例: [10:30:45] [Server thread/INFO]: TPS from last 5s, 10s, 1m, 5m, 15m: 20.0, 20.0, 20.0, 20.0, 20.0
   */
  private parseLine(line: string): LogLine | null {
    // 匹配日志格式
    const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\] \[([^\]]+)\/([^\]]+)\]: (.+)$/);
    
    if (!match) {
      return null;
    }

    const time = match[1];
    const thread = match[2];
    const level = match[3];
    const message = match[4];
    
    if (!time || !thread || !level || !message) {
      return null;
    }
    
    // 构造完整时间戳（使用今天的日期）
    const now = new Date();
    const [hours, minutes, seconds] = time.split(':').map(Number);
    const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);

    // 提取 logger 名称
    const loggerName = thread.split('/')[0] || thread;

    return {
      timestamp,
      level,
      thread,
      logger: loggerName,
      message,
      raw: line,
    };
  }
}

/**
 * 日志监听服务（管理所有监听器）
 */
export class LogMonitorService {
  private monitors: Map<string, LogMonitor> = new Map();
  private config: LogMonitorConfig;

  constructor() {
    this.config = appConfig.logMonitor;
  }

  /**
   * 为服务器启动日志监听
   * @param serverId 服务器 ID
   * @param serverDir 服务器根目录（绝对路径）
   */
  async startMonitoring(serverId: string, serverDir: string): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('日志监听功能未启用');
      return;
    }

    if (this.monitors.has(serverId)) {
      logger.debug(`服务器 ${serverId} 已在监听中`);
      return;
    }

    // 解析日志文件路径
    const logFilePath = path.isAbsolute(this.config.logPath)
      ? this.config.logPath
      : path.join(serverDir, this.config.logPath);

    // 检查文件是否存在
    if (!fs.existsSync(logFilePath)) {
      throw new Error(`日志文件不存在: ${logFilePath}`);
    }

    // 创建监听器
    const monitor = new LogMonitor(logFilePath, this.config);
    await monitor.start();
    
    this.monitors.set(serverId, monitor);
    logger.info(`已为服务器 ${serverId} 启动日志监听`);
  }

  /**
   * 停止服务器的日志监听
   */
  stopMonitoring(serverId: string): void {
    const monitor = this.monitors.get(serverId);
    if (monitor) {
      monitor.stop();
      this.monitors.delete(serverId);
      logger.info(`已停止服务器 ${serverId} 的日志监听`);
    }
  }

  /**
   * 停止所有监听
   */
  stopAll(): void {
    for (const [serverId, monitor] of this.monitors) {
      monitor.stop();
      logger.info(`已停止服务器 ${serverId} 的日志监听`);
    }
    this.monitors.clear();
  }

  /**
   * 监听服务器的日志行
   */
  onLogLine(serverId: string, callback: (line: LogLine) => void): void {
    const monitor = this.monitors.get(serverId);
    if (monitor) {
      monitor.on('line', callback);
    }
  }

  /**
   * 取消监听日志行
   */
  offLogLine(serverId: string, callback: (line: LogLine) => void): void {
    const monitor = this.monitors.get(serverId);
    if (monitor) {
      monitor.off('line', callback);
    }
  }

  /**
   * 等待匹配的日志行（带超时）
   * @param serverId 服务器 ID
   * @param predicate 匹配条件
   * @param timeout 超时时间（毫秒）
   * @returns 匹配的日志行或 null
   */
  async waitForLine(
    serverId: string,
    predicate: (line: LogLine) => boolean,
    timeout: number = this.config.sparkCommandTimeout
  ): Promise<LogLine | null> {
    const monitor = this.monitors.get(serverId);
    if (!monitor) {
      logger.warn(`服务器 ${serverId} 未在监听中`);
      return null;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        monitor.off('line', handler);
        resolve(null);
      }, timeout);

      const handler = (line: LogLine) => {
        if (predicate(line)) {
          clearTimeout(timer);
          monitor.off('line', handler);
          resolve(line);
        }
      };

      monitor.on('line', handler);
    });
  }

  /**
   * 收集多行输出（用于 spark 命令）
   * @param serverId 服务器 ID
   * @param startPredicate 开始匹配条件
   * @param endPredicate 结束匹配条件
   * @param timeout 超时时间（毫秒）
   * @returns 收集到的日志行数组
   */
  async collectLines(
    serverId: string,
    startPredicate: (line: LogLine) => boolean,
    endPredicate: (line: LogLine) => boolean,
    timeout: number = this.config.sparkCommandTimeout
  ): Promise<LogLine[]> {
    const monitor = this.monitors.get(serverId);
    if (!monitor) {
      logger.warn(`服务器 ${serverId} 未在监听中`);
      return [];
    }

    return new Promise((resolve) => {
      const lines: LogLine[] = [];
      let collecting = false;

      const timer = setTimeout(() => {
        monitor.off('line', handler);
        resolve(lines);
      }, timeout);

      const handler = (line: LogLine) => {
        if (!collecting && startPredicate(line)) {
          collecting = true;
          lines.push(line);
        } else if (collecting) {
          lines.push(line);
          if (endPredicate(line)) {
            clearTimeout(timer);
            monitor.off('line', handler);
            resolve(lines);
          }
        }
      };

      monitor.on('line', handler);
    });
  }
}

// 导出单例
export const logMonitorService = new LogMonitorService();
