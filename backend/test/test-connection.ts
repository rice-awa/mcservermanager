/**
 * 步骤 54: 连接测试
 * 测试 RCON 连接、WebSocket 连接和断线重连功能
 */
import { io, Socket } from 'socket.io-client';
import type { ServerConfig } from '../src/types';
import { configService } from '../src/services/config.service';
import { rconService } from '../src/services/rcon.service';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('ConnectionTests');

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
  error?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  totalDuration: number;
}

class ConnectionTestSuite {
  private socket: Socket | null = null;
  private testConfig: ServerConfig | null = null;
  private results: TestResult[] = [];

  /**
   * 初始化测试配置
   */
  private initTestConfig(): ServerConfig {
    const configs = configService.getAll();
    if (configs.length === 0) {
      throw new Error('未找到可用的服务器配置，请先创建配置');
    }
    const config = configs[0];
    if (!config) {
      throw new Error('配置为空');
    }
    this.testConfig = config;
    logger.info(`使用测试配置: ${config.name}`);
    return config;
  }

  /**
   * 测试 RCON 连接
   */
  async testRconConnection(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试 RCON 连接';

    try {
      if (!this.testConfig) {
        this.initTestConfig();
      }

      const result = await rconService.testConnection(this.testConfig!);

      if (result.success) {
        return {
          name: testName,
          passed: true,
          message: `RCON 连接成功 (延迟: ${result.latency}ms)`,
          duration: Date.now() - startTime,
        };
      } else {
        return {
          name: testName,
          passed: false,
          message: `RCON 连接失败: ${result.message}`,
          duration: Date.now() - startTime,
          error: result.message,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      return {
        name: testName,
        passed: false,
        message: `RCON 连接异常: ${errorMsg}`,
        duration: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  /**
   * 测试 WebSocket 连接
   */
  async testWebSocketConnection(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试 WebSocket 连接';

    return new Promise((resolve) => {
      const wsUrl = 'http://localhost:3001';
      const socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 5000,
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.disconnect();
          resolve({
            name: testName,
            passed: false,
            message: 'WebSocket 连接超时',
            duration: Date.now() - startTime,
            error: '5秒内未连接',
          });
        }
      }, 5000);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const connected = socket.connected;
          socket.disconnect();

          resolve({
            name: testName,
            passed: connected,
            message: `WebSocket 连接成功 (Socket ID: ${socket.id})`,
            duration: Date.now() - startTime,
          });
        }
      });

      socket.on('connect_error', (error: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();
          resolve({
            name: testName,
            passed: false,
            message: `WebSocket 连接错误: ${error.message}`,
            duration: Date.now() - startTime,
            error: error.message,
          });
        }
      });
    });
  }

  /**
   * 测试断线重连
   */
  async testReconnection(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试断线重连';

    return new Promise((resolve) => {
      const wsUrl = 'http://localhost:3001';
      const socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 500,
        reconnectionDelayMax: 1000,
      });

      let reconnected = false;
      let connected = false;
      let disconnected = false;

      const timeout = setTimeout(() => {
        socket.disconnect();
        resolve({
          name: testName,
          passed: false,
          message: '重连测试超时',
          duration: Date.now() - startTime,
          error: '10秒内未完成重连',
        });
      }, 10000);

      socket.on('connect', () => {
        logger.info('WebSocket 已连接');
        if (!connected) {
          connected = true;
          // 立即断开连接，测试重连
          setTimeout(() => {
            logger.info('主动断开连接...');
            socket.disconnect();
          }, 500);
        } else if (!reconnected && disconnected) {
          reconnected = true;
          clearTimeout(timeout);
          socket.disconnect();
          resolve({
            name: testName,
            passed: true,
            message: '成功进行断线重连',
            duration: Date.now() - startTime,
          });
        }
      });

      socket.on('disconnect', (reason: string) => {
        logger.info(`WebSocket 已断开: ${reason}`);
        if (connected && !disconnected) {
          disconnected = true;
          // 断开后等待自动重连
          logger.info('等待自动重连...');
        }
      });

      socket.on('connect_error', (error: Error) => {
        logger.error(`连接错误: ${error.message}`);
      });

      socket.on('reconnect_attempt', () => {
        logger.info('正在尝试重新连接...');
      });
    });
  }

  /**
   * 测试 MC 服务器连接
   */
  async testMcServerConnection(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试 MC 服务器连接';

    return new Promise((resolve) => {
      if (!this.testConfig) {
        resolve({
          name: testName,
          passed: false,
          message: '测试配置未初始化',
          duration: Date.now() - startTime,
          error: '配置为空',
        });
        return;
      }

      const wsUrl = 'http://localhost:3001';
      const socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 5000,
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.disconnect();
          resolve({
            name: testName,
            passed: false,
            message: '服务器连接超时',
            duration: Date.now() - startTime,
            error: '5秒内未收到响应',
          });
        }
      }, 5000);

      socket.on('connect', () => {
        logger.info(`WebSocket 已连接，连接到 MC 服务器: ${this.testConfig!.name}`);
        socket.emit('server:connect', { serverId: this.testConfig!.id });
      });

      socket.on('server:status', (data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();

          resolve({
            name: testName,
            passed: data.status === 'connected',
            message: `MC 服务器状态: ${data.status}`,
            duration: Date.now() - startTime,
          });
        }
      });

      socket.on('error', (data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();
          resolve({
            name: testName,
            passed: false,
            message: `连接错误: ${data.message}`,
            duration: Date.now() - startTime,
            error: data.message,
          });
        }
      });
    });
  }

  /**
   * 运行所有连接测试
   */
  async runAll(): Promise<TestSuite> {
    const startTime = Date.now();

    this.results = [
      await this.testRconConnection(),
      await this.testWebSocketConnection(),
      await this.testReconnection(),
      await this.testMcServerConnection(),
    ];

    const suite: TestSuite = {
      name: '连接测试',
      tests: this.results,
      passed: this.results.filter((t) => t.passed).length,
      failed: this.results.filter((t) => !t.passed).length,
      totalDuration: Date.now() - startTime,
    };

    return suite;
  }

  /**
   * 打印测试结果
   */
  printResults(suite: TestSuite): void {
    console.log('\n========================================');
    console.log(`\n📋 ${suite.name} 结果\n`);
    console.log('========================================\n');

    suite.tests.forEach((test) => {
      const status = test.passed ? '✓' : '✗';
      const color = test.passed ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';

      console.log(`${color}${status}${reset} ${test.name}`);
      console.log(`  消息: ${test.message}`);
      console.log(`  耗时: ${test.duration}ms`);

      if (test.error) {
        console.log(`  错误: ${test.error}`);
      }
      console.log('');
    });

    console.log('========================================');
    console.log(`总计: ${suite.tests.length} 个测试`);
    console.log(`通过: ${suite.passed} 个`);
    console.log(`失败: ${suite.failed} 个`);
    console.log(`总耗时: ${suite.totalDuration}ms`);
    console.log('========================================\n');
  }
}

// 导出用于外部测试
export { ConnectionTestSuite };
export type { TestResult, TestSuite };

// 如果作为脚本直接运行
if (require.main === module) {
  (async () => {
    try {
      const suite = new ConnectionTestSuite();
      const results = await suite.runAll();
      suite.printResults(results);

      // 退出代码：0 表示所有测试通过，1 表示有失败
      process.exit(results.failed > 0 ? 1 : 0);
    } catch (error) {
      logger.error('测试运行失败', { error });
      process.exit(1);
    }
  })();
}
