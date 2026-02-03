/**
 * 日志监听服务
 * 使用 fs.watch() + 轮询 监听 Minecraft 服务器日志文件
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
  private watcher: fs.FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private buffer: string = '';
  private isRunning: boolean = false;

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
    if (this.isRunning) {
      logger.warn('日志监听器已在运行');
      return;
    }

    try {
      logger.info(`启动日志监听: ${this.logFilePath}`);

      // 检查文件是否存在
      if (!fs.existsSync(this.logFilePath)) {
        throw new Error(`日志文件不存在: ${this.logFilePath}`);
      }

      // 获取文件大小并打开文件
      const stats = fs.statSync(this.logFilePath);
      this.position = stats.size;
      this.fd = fs.openSync(this.logFilePath, 'r');

      logger.debug(`文件大小: ${this.position} 字节, 文件描述符: ${this.fd}`);

      // 启动 fs.watch 监听文件变化
      this.watcher = fs.watch(this.logFilePath, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange();
        }
      });

      // 启动轮询作为备份
      this.pollTimer = setInterval(() => this.poll(), this.config.pollInterval);

      this.isRunning = true;
      logger.info('日志监听器已启动');
    } catch (error) {
      logger.error(`无法启动日志监听: ${this.logFilePath}`, error);
      throw error;
    }
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (!this.isRunning) return;

    logger.info(`停止日志监听: ${this.logFilePath}`);

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch (e) {
        // 忽略关闭错误
      }
      this.fd = null;
    }

    this.isRunning = false;
  }

  /**
   * 文件变化处理（由 fs.watch 触发）
   */
  private handleFileChange(): void {
    try {
      this.readNewContent();
    } catch (error) {
      logger.error('处理文件变化失败', error);
    }
  }

  /**
   * 轮询检查（由 setInterval 调用）
   */
  private poll(): void {
    if (!this.isRunning) return;

    try {
      this.readNewContent();
    } catch (error: any) {
      // 忽略 ENOENT 错误（文件暂时不存在）
      if (error.code !== 'ENOENT') {
        // 静默处理其他轮询错误
      }
    }
  }

  /**
   * 读取新内容
   */
  private readNewContent(): void {
    if (this.fd === null) return;

    try {
      const stats = fs.fstatSync(this.fd);
      const newSize = stats.size;

        if (newSize > this.position) {
        const bytesToRead = newSize - this.position;
        logger.debug(`读取 ${bytesToRead} 字节 (位置: ${this.position} → ${newSize})`);

        const buffer = Buffer.alloc(bytesToRead);
        const bytesRead = fs.readSync(this.fd, buffer, 0, bytesToRead, this.position);

        if (bytesRead > 0) {
          this.position = newSize;
          const content = buffer.toString(this.config.encoding as BufferEncoding);
          logger.debug(`解析前内容: ${content.substring(0, 200)}`);
          this.processContent(content);
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // 文件暂时不存在，忽略
      } else {
        throw error;
      }
    }
  }

  /**
   * 处理读取到的内容
   */
  private processContent(content: string): void {
    this.buffer += content;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

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
   */
  private parseLine(line: string): LogLine | null {
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

    const now = new Date();
    const [hours, minutes, seconds] = time.split(':').map(Number);
    const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);

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

    const logFilePath = path.isAbsolute(this.config.logPath)
      ? this.config.logPath
      : path.join(serverDir, this.config.logPath);

    if (!fs.existsSync(logFilePath)) {
      throw new Error(`日志文件不存在: ${logFilePath}`);
    }

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
   * 监听日志行
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
   * 收集多行输出
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

export const logMonitorService = new LogMonitorService();
