/**
 * 测试日志监听服务
 */
import { Rcon } from 'rcon-client';
import { LogMonitorService } from './src/services/log-monitor.service';
import * as path from 'path';

// 配置
const RCON_CONFIG = {
  host: 'localhost',
  port: 25575,
  password: 'riceawa123456',
  timeout: 5000,
};

const SERVER_DIR = 'D:\\MCTESTSERVER\\1.21.11'; // MC 服务器目录
const SERVER_ID = 'test-server';

async function test() {
  console.log('====================================');
  console.log('测试日志监听服务');
  console.log('====================================\n');

  // 1. 创建日志监听服务
  const logMonitor = new LogMonitorService();
  
  // 2. 启动日志监听
  try {
    await logMonitor.startMonitoring(SERVER_ID, SERVER_DIR);
    console.log('✓ 日志监听已启动\n');
    // 等待监听器稳定
    await new Promise(r => setTimeout(r, 500));
  } catch (error) {
    console.error('✗ 启动日志监听失败:', error);
    return;
  }

  // 3. 连接 RCON
  const rcon = new Rcon(RCON_CONFIG);
  try {
    await rcon.connect();
    console.log('✓ RCON 连接成功\n');
  } catch (error) {
    console.error('✗ RCON 连接失败:', error);
    logMonitor.stopAll();
    return;
  }

  console.log('====================================');
  console.log('测试 1: 监听所有日志行');
  console.log('====================================\n');

  // 监听日志行
  let lineCount = 0;
  const logHandler = (line: any) => {
    lineCount++;
    console.log(`[${line.timestamp.toLocaleTimeString()}] [${line.level}] ${line.message}`);
  };
  logMonitor.onLogLine(SERVER_ID, logHandler);

  // 发送一个简单命令
  console.log('发送命令: list\n');
  await rcon.send('list');
  await new Promise(r => setTimeout(r, 2000)); // 增加等待时间到 2 秒

  console.log(`\n捕获到 ${lineCount} 行日志\n`);

  console.log('====================================');
  console.log('测试 2: 等待特定日志行');
  console.log('====================================\n');

  // 发送 spark tps 命令并等待输出
  console.log('发送命令: spark tps');
  
  // 先设置监听器
  const tpsPromise = logMonitor.waitForLine(
    SERVER_ID,
    (line) => line.message.includes('⚡') && line.message.includes('TPS from last'),
    8000 // 增加超时时间
  );

  // 等待一点时间确保监听器已设置
  await new Promise(r => setTimeout(r, 100));
  
  // 发送命令
  await rcon.send('spark tps');
  const tpsLine = await tpsPromise;

  if (tpsLine) {
    console.log('✓ 捕获到 TPS 输出:');
    console.log(`  ${tpsLine.message}\n`);
  } else {
    console.log('✗ 未捕获到 TPS 输出（超时）\n');
  }

  console.log('====================================');
  console.log('测试 3: 收集多行输出');
  console.log('====================================\n');

  // 发送 spark healthreport 命令并收集输出
  console.log('发送命令: spark healthreport');
  
  // 先设置监听器
  const healthPromise = logMonitor.collectLines(
    SERVER_ID,
    (line) => line.message.includes('⚡') && line.message.includes('TPS from last'),
    (line) => line.message.includes('⚡') && (line.message.includes('Memory usage') || line.message.includes('process')),
    8000 // 增加超时时间
  );

  // 等待一点时间确保监听器已设置
  await new Promise(r => setTimeout(r, 100));

  // 发送命令
  await rcon.send('spark healthreport');
  const healthLines = await healthPromise;

  if (healthLines.length > 0) {
    console.log(`✓ 捕获到 ${healthLines.length} 行输出:\n`);
    for (const line of healthLines) {
      console.log(`  ${line.message}`);
    }
    console.log('');
  } else {
    console.log('✗ 未捕获到 health 输出（超时）\n');
  }

  // 清理
  rcon.end();
  logMonitor.stopAll();
  console.log('====================================');
  console.log('测试完成');
  console.log('====================================');
}

test().catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});
