/**
 * 统一的功能测试运行器
 * 同时运行连接、控制台和仪表盘测试
 */
import { ConnectionTestSuite } from './test-connection';
import { ConsoleTestSuite } from './test-console';
import { DashboardTestSuite } from './test-dashboard';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('FunctionalTests');

interface TestSuiteResult {
  name: string;
  passed: number;
  failed: number;
  total: number;
  totalDuration: number;
}

class FunctionalTestRunner {
  private suites: TestSuiteResult[] = [];

  /**
   * 运行所有功能测试
   */
  async runAll(): Promise<void> {
    const startTime = Date.now();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   MC Server Manager 功能测试套件      ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
      // 步骤 54: 连接测试
      console.log('▶ 开始运行连接测试 (步骤 54)...\n');
      const connectionSuite = new ConnectionTestSuite();
      const connectionResults = await connectionSuite.runAll();
      connectionSuite.printResults(connectionResults);
      this.suites.push({
        name: connectionResults.name,
        passed: connectionResults.passed,
        failed: connectionResults.failed,
        total: connectionResults.tests.length,
        totalDuration: connectionResults.totalDuration,
      });

      // 步骤 55: 控制台测试
      console.log('▶ 开始运行控制台测试 (步骤 55)...\n');
      const consoleSuite = new ConsoleTestSuite();
      const consoleResults = await consoleSuite.runAll();
      consoleSuite.printResults(consoleResults);
      this.suites.push({
        name: consoleResults.name,
        passed: consoleResults.passed,
        failed: consoleResults.failed,
        total: consoleResults.tests.length,
        totalDuration: consoleResults.totalDuration,
      });

      // 步骤 56: 仪表盘测试
      console.log('▶ 开始运行仪表盘测试 (步骤 56)...\n');
      const dashboardSuite = new DashboardTestSuite();
      const dashboardResults = await dashboardSuite.runAll();
      dashboardSuite.printResults(dashboardResults);
      this.suites.push({
        name: dashboardResults.name,
        passed: dashboardResults.passed,
        failed: dashboardResults.failed,
        total: dashboardResults.tests.length,
        totalDuration: dashboardResults.totalDuration,
      });

      // 打印总体结果
      this.printOverallResults(Date.now() - startTime);
    } catch (error) {
      logger.error('测试运行失败', { error });
      process.exit(1);
    }
  }

  /**
   * 打印总体结果
   */
  private printOverallResults(totalDuration: number): void {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║         测试总体结果摘要              ║');
    console.log('╚════════════════════════════════════════╝\n');

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    this.suites.forEach((suite) => {
      const status = suite.failed === 0 ? '✓' : '✗';
      const color = suite.failed === 0 ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';

      console.log(`${color}${status}${reset} ${suite.name}`);
      console.log(`  通过: ${suite.passed}/${suite.total}`);
      console.log(`  耗时: ${suite.totalDuration}ms`);
      console.log('');

      totalTests += suite.total;
      totalPassed += suite.passed;
      totalFailed += suite.failed;
    });

    console.log('========================================');
    console.log(`总计: ${totalTests} 个测试`);
    console.log(`通过: ${totalPassed} 个`);
    console.log(`失败: ${totalFailed} 个`);
    console.log(`总耗时: ${totalDuration}ms`);
    console.log('========================================\n');

    if (totalFailed === 0) {
      console.log('\x1b[32m🎉 所有测试都通过了！\x1b[0m\n');
    } else {
      console.log(
        `\x1b[31m⚠ 有 ${totalFailed} 个测试失败，请检查日志\x1b[0m\n`
      );
    }

    // 测试建议
    this.printTestingRecommendations();
  }

  /**
   * 打印测试建议
   */
  private printTestingRecommendations(): void {
    console.log('📋 测试建议:\n');
    console.log('1. 连接测试:');
    console.log('   - 确保 Minecraft 服务器已启用 RCON');
    console.log('   - 检查 RCON 端口和密码配置');
    console.log('   - 确认防火墙允许 RCON 连接\n');

    console.log('2. 控制台测试:');
    console.log('   - 确保已成功连接到 MC 服务器');
    console.log('   - 检查命令执行权限');
    console.log('   - 查看后端日志了解命令执行详情\n');

    console.log('3. 仪表盘测试:');
    console.log('   - 确保 Spark Mod 已正确安装');
    console.log('   - 检查 Spark API 端点配置');
    console.log('   - 验证数据收集是否正常\n');

    console.log('📚 相关文档:');
    console.log('   - 后端对接文档: backend/backend-integration.md');
    console.log('   - 前端集成指南: FRONTEND_INTEGRATION_GUIDE.md');
    console.log('   - 快速启动: QUICKSTART.md\n');
  }
}

// 运行测试
if (require.main === module) {
  (async () => {
    const runner = new FunctionalTestRunner();
    await runner.runAll();
    process.exit(0);
  })();
}
