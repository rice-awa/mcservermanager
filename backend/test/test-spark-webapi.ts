/**
 * 测试 Spark Web API 集成
 * 
 * 测试流程：
 * 1. 连接到 RCON
 * 2. 执行 spark health --upload
 * 3. 获取并解析 JSON 数据
 * 4. 显示解析结果
 * 
 * 使用方法：
 * npx ts-node test-spark-webapi.ts [host] [port] [password]
 * 
 * 示例：
 * npx ts-node test-spark-webapi.ts localhost 25575 mypassword
 */

import { sparkService } from '../src/services/spark.service';
import { rconService } from '../src/services/rcon.service';
import { logMonitorService } from '../src/services/log-monitor.service';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('TestSparkWebAPI');

async function testSparkWebApi() {
  // 从命令行参数获取服务器配置
  const host = process.argv[2] || 'localhost';
  const port = parseInt(process.argv[3] || '25575', 10);
  const password = process.argv[4] || '';
  const serverDir = process.argv[5] || 'D:\\MCTESTSERVER\\1.21.11'; // 服务器根目录

  if (!password) {
    logger.error('请提供 RCON 密码');
    logger.info('使用方法: npx ts-node test-spark-webapi.ts [host] [port] [password] [serverDir]');
    logger.info('示例: npx ts-node test-spark-webapi.ts localhost 25575 mypassword D:\\MCTESTSERVER\\1.21.11');
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
    logger.info('开始测试 Spark Web API 集成');
    logger.info('='.repeat(60));
    logger.info(`服务器: ${host}:${port}`);
    logger.info(`日志目录: ${serverDir}`);
    logger.info('');

    // 0. 启动日志监听
    logger.info('[步骤 0] 启动日志监听...');
    await logMonitorService.startMonitoring(serverId, serverDir);
    logger.info('✓ 日志监听已启动');

    // 1. 连接 RCON
    logger.info('\n[步骤 1] 连接 RCON...');
    await rconService.connect(serverConfig);
    logger.info('✓ RCON 连接成功');

    // 2. 测试基本命令
    logger.info('\n[步骤 2] 测试基本命令...');
    const listResult = await rconService.send(serverId, 'list');
    if (!listResult.success) {
      logger.error('✗ 命令执行失败');
      return;
    }
    logger.info(`✓ 命令响应: ${listResult.response.substring(0, 50)}...`);

    // 3. 获取健康报告
    logger.info('\n[步骤 3] 获取健康报告...');
    logger.info('执行: spark health --upload');
    logger.info('提示: 命令输出会异步写入日志文件，请等待...');
    
    const health = await sparkService.getHealth(serverId);
    
    if (!health) {
      logger.error('✗ 获取健康报告失败');
      logger.info('');
      logger.info('可能的原因：');
      logger.info('1. Spark 插件未安装或未启用');
      logger.info('2. 日志监听未正确启动');
      logger.info('3. 网络问题导致无法访问 spark.lucko.me');
      return;
    }

    logger.info('✓ 成功获取健康报告');
    logger.info('\n' + '='.repeat(60));
    logger.info('健康报告详情：');
    logger.info('='.repeat(60));

    // 4. 显示 TPS
    logger.info('\n【TPS】');
    logger.info(`  Last 5s:  ${health.tps.last5s.toFixed(2)}`);
    logger.info(`  Last 10s: ${health.tps.last10s.toFixed(2)}`);
    logger.info(`  Last 1m:  ${health.tps.last1m.toFixed(2)}`);
    logger.info(`  Last 5m:  ${health.tps.last5m.toFixed(2)}`);
    logger.info(`  Last 15m: ${health.tps.last15m.toFixed(2)}`);

    // 5. 显示 MSPT
    logger.info('\n【MSPT (毫秒/tick)】');
    logger.info(`  Min:     ${health.mspt.min.toFixed(2)} ms`);
    logger.info(`  Median:  ${health.mspt.median.toFixed(2)} ms`);
    logger.info(`  95%ile:  ${health.mspt.percentile95.toFixed(2)} ms`);
    logger.info(`  Max:     ${health.mspt.max.toFixed(2)} ms`);

    // 6. 显示 CPU
    logger.info('\n【CPU 使用率】');
    logger.info('  进程:');
    logger.info(`    Last 10s: ${health.cpu.process.last10s.toFixed(2)}%`);
    logger.info(`    Last 1m:  ${health.cpu.process.last1m.toFixed(2)}%`);
    logger.info(`    Last 15m: ${health.cpu.process.last15m.toFixed(2)}%`);
    logger.info('  系统:');
    logger.info(`    Last 10s: ${health.cpu.system.last10s.toFixed(2)}%`);
    logger.info(`    Last 1m:  ${health.cpu.system.last1m.toFixed(2)}%`);
    logger.info(`    Last 15m: ${health.cpu.system.last15m.toFixed(2)}%`);

    // 7. 显示内存
    logger.info('\n【内存】');
    logger.info(`  使用: ${health.memory.used} MB`);
    logger.info(`  分配: ${health.memory.allocated} MB`);
    logger.info(`  最大: ${health.memory.max} MB`);
    if (health.memory.max > 0) {
      logger.info(`  使用率: ${((health.memory.used / health.memory.max) * 100).toFixed(2)}%`);
    }

    // 8. 显示磁盘（如果有）
    if (health.disk) {
      logger.info('\n【磁盘】');
      logger.info(`  使用: ${health.disk.used} GB`);
      logger.info(`  总计: ${health.disk.total} GB`);
      if (health.disk.total > 0) {
        logger.info(`  使用率: ${((health.disk.used / health.disk.total) * 100).toFixed(2)}%`);
      }
    }

    // 9. 显示时间戳
    logger.info('\n【元数据】');
    logger.info(`  时间戳: ${new Date(health.timestamp).toLocaleString('zh-CN')}`);

    logger.info('\n' + '='.repeat(60));
    logger.info('✓ 测试完成');
    logger.info('='.repeat(60));

    // 10. 测试缓存
    logger.info('\n[步骤 4] 测试缓存机制...');
    const startTime = Date.now();
    const cachedHealth = await sparkService.getHealth(serverId);
    const cacheTime = Date.now() - startTime;
    
    if (cachedHealth && cachedHealth.timestamp === health.timestamp) {
      logger.info(`✓ 缓存机制正常工作（耗时: ${cacheTime}ms）`);
    } else {
      logger.warn('⚠ 缓存可能未生效');
    }

    // 11. 清理
    logger.info('\n[步骤 5] 清理连接...');
    await rconService.disconnect(serverId);
    logMonitorService.stopMonitoring(serverId);
    logger.info('✓ 连接已关闭');

  } catch (error) {
    logger.error('测试过程中发生错误:', error);
  } finally {
    // 确保清理资源
    logMonitorService.stopAll();
    // 确保进程退出
    setTimeout(() => process.exit(0), 1000);
  }
}

// 运行测试
testSparkWebApi().catch((error) => {
  logger.error('测试失败:', error);
  process.exit(1);
});
