/**
 * 步骤 56: 仪表盘测试
 * 测试数据更新、图表展示和状态刷新功能
 */
import { io, Socket } from 'socket.io-client';
import type { ServerConfig, ServerStats, TPSData } from '../src/types';
import { configService } from '../src/services/config.service';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('DashboardTests');

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
  error?: string;
  data?: unknown;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  totalDuration: number;
}

class DashboardTestSuite {
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
   * 测试获取当前服务器状态
   */
  async testGetCurrentStats(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试获取当前状态';

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
            message: '获取状态超时',
            duration: Date.now() - startTime,
            error: '10秒内未收到响应',
          });
        }
      }, 10000);

      socket.on('connect', () => {
        logger.info('WebSocket 已连接');
        socket.emit('server:connect', { serverId: this.testConfig!.id });
      });

      socket.on('server:status', (data) => {
        if (data.status === 'connected') {
          logger.info('已连接到 MC 服务器，获取状态...');
          socket.emit('stats:subscribe', { serverId: this.testConfig!.id });
        }
      });

      socket.on('statsUpdate', (data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();

          const stats = data.payload.stats as ServerStats;
          const passed =
            stats.tps !== undefined &&
            stats.cpu !== undefined &&
            stats.memory !== undefined &&
            stats.onlinePlayers !== undefined;

          resolve({
            name: testName,
            passed,
            message: `获取状态成功: TPS=${stats.tps.toFixed(2)}, CPU=${stats.cpu}%, 玩家=${stats.onlinePlayers}/${stats.maxPlayers}`,
            duration: Date.now() - startTime,
            data: stats,
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
            message: `获取状态失败: ${data.message}`,
            duration: Date.now() - startTime,
            error: data.message,
          });
        }
      });
    });
  }

  /**
   * 测试实时状态更新
   */
  async testRealtimeUpdates(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试实时状态更新';
    let updateCount = 0;
    const statsUpdates: ServerStats[] = [];

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
            passed: updateCount >= 3,
            message: `收到 ${updateCount} 个状态更新 (预期至少 3 个)`,
            duration: Date.now() - startTime,
            data: { updateCount, updates: statsUpdates },
          });
        }
      }, 15000);

      socket.on('connect', () => {
        logger.info('WebSocket 已连接');
        socket.emit('server:connect', { serverId: this.testConfig!.id });
      });

      socket.on('server:status', (data) => {
        if (data.status === 'connected') {
          logger.info('已连接到 MC 服务器，开始订阅状态更新');
          socket.emit('stats:subscribe', { serverId: this.testConfig!.id });
        }
      });

      socket.on('statsUpdate', (data) => {
        updateCount++;
        const stats = data.payload.stats as ServerStats;
        statsUpdates.push(stats);
        logger.info(
          `收到第 ${updateCount} 个更新: TPS=${stats.tps.toFixed(2)}, CPU=${stats.cpu}%`
        );

        if (updateCount >= 3) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            socket.disconnect();

            resolve({
              name: testName,
              passed: true,
              message: `成功接收 ${updateCount} 个实时状态更新`,
              duration: Date.now() - startTime,
              data: { updateCount, updates: statsUpdates },
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
            message: `接收更新出错: ${data.message}`,
            duration: Date.now() - startTime,
            error: data.message,
          });
        }
      });
    });
  }

  /**
   * 测试数据有效性
   */
  async testDataValidity(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试数据有效性';

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
            message: '获取数据超时',
            duration: Date.now() - startTime,
            error: '10秒内未收到响应',
          });
        }
      }, 10000);

      socket.on('connect', () => {
        socket.emit('server:connect', { serverId: this.testConfig!.id });
      });

      socket.on('server:status', (data) => {
        if (data.status === 'connected') {
          socket.emit('stats:subscribe', { serverId: this.testConfig!.id });
        }
      });

      socket.on('statsUpdate', (data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();

          const stats = data.payload.stats as ServerStats;
          const issues: string[] = [];

          // 验证数据有效性
          if (typeof stats.tps !== 'number' || stats.tps < 0 || stats.tps > 20) {
            issues.push(`TPS 值无效: ${stats.tps}`);
          }

          if (typeof stats.cpu !== 'number' || stats.cpu < 0 || stats.cpu > 100) {
            issues.push(`CPU 值无效: ${stats.cpu}%`);
          }

          if (
            !stats.memory ||
            typeof stats.memory.used !== 'number' ||
            typeof stats.memory.max !== 'number'
          ) {
            issues.push('内存数据无效');
          }

          if (
            typeof stats.onlinePlayers !== 'number' ||
            typeof stats.maxPlayers !== 'number'
          ) {
            issues.push('玩家数据无效');
          }

          if (issues.length > 0) {
            resolve({
              name: testName,
              passed: false,
              message: `数据验证失败: ${issues.join(', ')}`,
              duration: Date.now() - startTime,
              error: issues.join('; '),
              data: stats,
            });
          } else {
            resolve({
              name: testName,
              passed: true,
              message: '所有数据都有效且符合预期范围',
              duration: Date.now() - startTime,
              data: stats,
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
            message: `数据验证失败: ${data.message}`,
            duration: Date.now() - startTime,
            error: data.message,
          });
        }
      });
    });
  }

  /**
   * 测试多服务器状态数据
   */
  async testMultipleServersData(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '测试多服务器数据';
    const configs = configService.getAll();

    if (configs.length < 2) {
      return {
        name: testName,
        passed: true,
        message: `配置数少于 2 个，跳过此测试 (共 ${configs.length} 个)`,
        duration: Date.now() - startTime,
      };
    }

    // 如果有多个配置，测试逐个获取状态
    return new Promise((resolve) => {
      let receivedCount = 0;
      const totalConfigs = configs.length;

      const testConfig = async (index: number) => {
        if (index >= configs.length) {
          resolve({
            name: testName,
            passed: receivedCount > 0,
            message: `成功获取 ${receivedCount} 个服务器的状态数据`,
            duration: Date.now() - startTime,
          });
          return;
        }

        const wsUrl = 'http://localhost:3001';
        const socket = io(wsUrl, {
          transports: ['websocket', 'polling'],
          reconnection: false,
          timeout: 5000,
        });

        const timeout = setTimeout(() => {
          socket.disconnect();
          testConfig(index + 1);
        }, 5000);

        socket.on('connect', () => {
          socket.emit('server:connect', { serverId: configs[index]!.id });
        });

        socket.on('statsUpdate', () => {
          clearTimeout(timeout);
          receivedCount++;
          socket.disconnect();
          testConfig(index + 1);
        });

        socket.on('error', () => {
          clearTimeout(timeout);
          socket.disconnect();
          testConfig(index + 1);
        });

        socket.on('connect_error', () => {
          clearTimeout(timeout);
          socket.disconnect();
          testConfig(index + 1);
        });
      };

      testConfig(0);
    });
  }

  /**
   * 运行所有仪表盘测试
   */
  async runAll(): Promise<TestSuite> {
    const startTime = Date.now();

    this.results = [
      await this.testGetCurrentStats(),
      await this.testRealtimeUpdates(),
      await this.testDataValidity(),
      await this.testMultipleServersData(),
    ];

    const suite: TestSuite = {
      name: '仪表盘测试',
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
export { DashboardTestSuite };
export type { TestResult, TestSuite };

// 如果作为脚本直接运行
if (require.main === module) {
  (async () => {
    try {
      const suite = new DashboardTestSuite();
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
