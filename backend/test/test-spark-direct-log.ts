/**
 * 测试直接从日志文件读取 Spark URL 的新实现
 * 不使用日志监听,而是执行命令后直接读取日志文件
 */

import { rconService } from '../src/services/rcon.service';
import { sparkService } from '../src/services/spark.service';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('TestSparkDirectLog');

async function testSparkDirectLog() {
  const host = process.argv[2] || 'localhost';
  const port = parseInt(process.argv[3] || '25575', 10);
  const password = process.argv[4] || '';
  const logFilePath = process.argv[5] || 'D:\\MCTESTSERVER\\1.21.11\\logs\\latest.log';

  if (!password) {
    logger.error('请提供 RCON 密码');
    logger.info('使用方法: npx ts-node test-spark-direct-log.ts [host] [port] [password] [logFilePath]');
    logger.info('示例: npx ts-node test-spark-direct-log.ts localhost 25575 mypassword D:\\MCTESTSERVER\\1.21.11\\logs\\latest.log');
    process.exit(1);
  }

  const serverId = 'test-server';
  const serverConfig = {
    id: serverId,
    name: 'Test Server',
    host,
    port,
    password,
  };

  try {
    logger.info('='.repeat(60));
    logger.info('测试 Spark 直接读取日志方案');
    logger.info('='.repeat(60));
    logger.info(`服务器: ${host}:${port}`);
    logger.info(`日志文件: ${logFilePath}`);
    logger.info('');

    // 1. 设置日志文件路径
    logger.info('[步骤 1] 设置日志文件路径...');
    sparkService.setLogPath(logFilePath);
    logger.info('✓ 日志路径已设置');

    // 2. 连接 RCON
    logger.info('\n[步骤 2] 连接 RCON...');
    await rconService.connect(serverConfig);
    logger.info('✓ RCON 连接成功');

    // 3. 测试基本命令
    logger.info('\n[步骤 3] 测试基本命令...');
    const listResult = await rconService.send(serverId, 'list');
    if (!listResult.success) {
      logger.error('✗ 命令执行失败');
      return;
    }
    logger.info(`✓ 命令响应: ${listResult.response.substring(0, 50)}...`);

    // 4. 获取健康报告
    logger.info('\n[步骤 4] 获取健康报告...');
    logger.info('执行: spark health --upload');
    logger.info('提示: 命令执行后会等待 2 秒,然后读取日志文件最后 50 行');
    
    const startTime = Date.now();
    const health = await sparkService.getHealth(serverId);
    const duration = Date.now() - startTime;
    
    if (!health) {
      logger.error('✗ 获取健康报告失败');
      logger.info('');
      logger.info('可能的原因：');
      logger.info('1. Spark 插件未安装或未启用');
      logger.info('2. 日志文件路径不正确');
      logger.info('3. 网络问题导致无法访问 spark.lucko.me');
      return;
    }

    logger.info(`✓ 成功获取健康报告 (耗时: ${duration}ms)`);
    logger.info('\n' + '='.repeat(60));
    logger.info('健康报告详情：');
    logger.info('='.repeat(60));

    // 5. 显示 TPS
    logger.info('\n【TPS】');
    logger.info(`  Last 5s:  ${health.tps.last5s.toFixed(2)}`);
    logger.info(`  Last 10s: ${health.tps.last10s.toFixed(2)}`);
    logger.info(`  Last 1m:  ${health.tps.last1m.toFixed(2)}`);
    logger.info(`  Last 5m:  ${health.tps.last5m.toFixed(2)}`);
    logger.info(`  Last 15m: ${health.tps.last15m.toFixed(2)}`);

    // 6. 显示 MSPT
    logger.info('\n【MSPT (毫秒/tick)】');
    logger.info(`  Min:    ${health.mspt.min.toFixed(2)}`);
    logger.info(`  Median: ${health.mspt.median.toFixed(2)}`);
    logger.info(`  95th:   ${health.mspt.percentile95.toFixed(2)}`);
    logger.info(`  Max:    ${health.mspt.max.toFixed(2)}`);

    // 7. 显示 CPU
    logger.info('\n【CPU 使用率 (%)】');
    logger.info('  进程:');
    logger.info(`    Last 10s: ${health.cpu.process.last10s.toFixed(2)}`);
    logger.info(`    Last 1m:  ${health.cpu.process.last1m.toFixed(2)}`);
    logger.info(`    Last 15m: ${health.cpu.process.last15m.toFixed(2)}`);
    logger.info('  系统:');
    logger.info(`    Last 10s: ${health.cpu.system.last10s.toFixed(2)}`);
    logger.info(`    Last 1m:  ${health.cpu.system.last1m.toFixed(2)}`);
    logger.info(`    Last 15m: ${health.cpu.system.last15m.toFixed(2)}`);

    // 8. 显示内存
    logger.info('\n【内存 (MB)】');
    logger.info(`  已用:     ${health.memory.used}`);
    logger.info(`  已分配:   ${health.memory.allocated}`);
    logger.info(`  最大:     ${health.memory.max}`);

    // 9. 显示磁盘（如果有）
    if (health.disk) {
      logger.info('\n【磁盘 (GB)】');
      logger.info(`  已用:  ${health.disk.used}`);
      logger.info(`  总计:  ${health.disk.total}`);
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('测试完成!');
    logger.info('='.repeat(60));

    // 清理
    await rconService.disconnect(serverId);

  } catch (error) {
    logger.error('测试失败:', error);
  } finally {
    setTimeout(() => process.exit(0), 1000);
  }
}

testSparkDirectLog().catch(console.error);
