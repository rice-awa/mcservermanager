/**
 * 步骤 55: 控制台测试
 * 测试命令发送、响应显示和历史记录功能
 */
import { io, Socket } from 'socket.io-client';
import type { ServerConfig, ConsoleMessage } from '../src/types';
import { configService } from '../src/services/config.service';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('ConsoleTests');

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

class ConsoleTestSuite {
  private socket: Socket | null = null;
  private testConfig: ServerConfig | null = null;
  private results: TestResult[] = [];
  private receivedMessages: ConsoleMessage[] = [];

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
   * 测试命令发送
   */
  async testCommandSending(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试命令发送';

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
        timeout: 10000,
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.disconnect();
          resolve({
            name: testName,
            passed: false,
            message: '命令发送超时',
            duration: Date.now() - startTime,
            error: '10秒内未收到响应',
          });
        }
      }, 10000);

      socket.on('connect', () => {
        logger.info('WebSocket 已连接，连接到 MC 服务器');
        socket.emit('server:connect', { serverId: this.testConfig!.id });
      });

      socket.on('server:status', (data) => {
        if (data.status === 'connected') {
          logger.info('已连接到 MC 服务器，发送测试命令: list');
          socket.emit('console:command', {
            serverId: this.testConfig!.id,
            command: 'list',
          });
        }
      });

      socket.on('commandOutput', (data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();

          resolve({
            name: testName,
            passed: true,
            message: `命令发送成功，收到响应: ${data.payload.message.content.substring(0, 50)}...`,
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
            message: `命令发送失败: ${data.message}`,
            duration: Date.now() - startTime,
            error: data.message,
          });
        }
      });
    });
  }

  /**
   * 测试多个命令
   */
  async testMultipleCommands(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试多个命令';
    const commands = ['list', 'help', 'time query daytime'];
    let responseCount = 0;

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
        timeout: 15000,
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.disconnect();
          resolve({
            name: testName,
            passed: false,
            message: `只收到 ${responseCount} 个响应，预期 ${commands.length} 个`,
            duration: Date.now() - startTime,
            error: '超时',
          });
        }
      }, 15000);

      socket.on('connect', () => {
        logger.info('WebSocket 已连接');
        socket.emit('server:connect', { serverId: this.testConfig!.id });
      });

      socket.on('server:status', (data) => {
        if (data.status === 'connected') {
          logger.info('已连接到 MC 服务器，发送测试命令');
          commands.forEach((cmd) => {
            setTimeout(() => {
              socket.emit('console:command', {
                serverId: this.testConfig!.id,
                command: cmd,
              });
            }, 500);
          });
        }
      });

      socket.on('commandOutput', () => {
        responseCount++;
        logger.info(`收到第 ${responseCount} 个响应`);

        if (responseCount >= commands.length) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            socket.disconnect();

            resolve({
              name: testName,
              passed: true,
              message: `成功发送并接收 ${responseCount} 个命令响应`,
              duration: Date.now() - startTime,
            });
          }
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
            message: `命令执行出错: ${data.message}`,
            duration: Date.now() - startTime,
            error: data.message,
          });
        }
      });
    });
  }

  /**
   * 测试控制台消息类型
   */
  async testMessageTypes(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试消息类型';

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
        timeout: 10000,
      });

      const messageTypes = new Set<string>();
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.disconnect();
          const foundTypes = Array.from(messageTypes).join(', ');
          const passed = messageTypes.size > 0;
          resolve({
            name: testName,
            passed,
            message: `检测到 ${messageTypes.size} 种消息类型: ${foundTypes}`,
            duration: Date.now() - startTime,
          });
        }
      }, 10000);

      socket.on('connect', () => {
        socket.emit('server:connect', { serverId: this.testConfig!.id });
      });

      socket.on('server:status', (data) => {
        if (data.status === 'connected') {
          socket.emit('console:command', {
            serverId: this.testConfig!.id,
            command: 'list',
          });
        }
      });

      socket.on('commandOutput', (data) => {
        if (data.payload.message.type) {
          messageTypes.add(data.payload.message.type);
          logger.info(`检测到消息类型: ${data.payload.message.type}`);
        }

        // 收到几个响应后结束
        if (messageTypes.size >= 2) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            socket.disconnect();
            resolve({
              name: testName,
              passed: true,
              message: `检测到 ${messageTypes.size} 种消息类型`,
              duration: Date.now() - startTime,
            });
          }
        }
      });
    });
  }

  /**
   * 运行所有控制台测试
   */
  async runAll(): Promise<TestSuite> {
    const startTime = Date.now();

    this.results = [
      await this.testCommandSending(),
      await this.testMultipleCommands(),
      await this.testMessageTypes(),
    ];

    const suite: TestSuite = {
      name: '控制台测试',
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
export { ConsoleTestSuite };
export type { TestResult, TestSuite };

// 如果作为脚本直接运行
if (require.main === module) {
  (async () => {
    try {
      const suite = new ConsoleTestSuite();
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
