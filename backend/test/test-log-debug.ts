/**
 * 调试日志监听器
 */

import * as fs from 'fs';
import * as path from 'path';

const logPath = 'D:\\MCTESTSERVER\\1.21.11\\logs\\latest.log';

async function debugLogMonitor() {
  console.log('=== 日志监听调试 ===\n');

  // 1. 检查文件是否存在
  console.log('[1] 检查文件状态...');
  if (!fs.existsSync(logPath)) {
    console.error('❌ 文件不存在!');
    return;
  }
  console.log('✓ 文件存在');

  // 2. 获取初始状态
  const initialStats = fs.statSync(logPath);
  console.log(`✓ 文件大小: ${initialStats.size} 字节`);

  // 3. 打开文件
  let fd: number;
  try {
    fd = fs.openSync(logPath, 'r');
    console.log('✓ 文件打开成功');
  } catch (error) {
    console.error('❌ 打开文件失败:', error);
    return;
  }

  // 4. 读取当前位置
  const position = initialStats.size;
  console.log(`✓ 初始位置: ${position}`);

  // 5. 测试读取
  console.log('\n[2] 测试读取...');
  const testBuffer = Buffer.alloc(100);
  try {
    const bytesRead = fs.readSync(fd, testBuffer, 0, 100, position - 100);
    const content = testBuffer.toString('utf-8', 0, bytesRead);
    console.log(`✓ 读取成功: ${bytesRead} 字节`);
    console.log(`最后内容: ${content.slice(-100)}`);
  } catch (error) {
    console.error('❌ 读取失败:', error);
  }

  // 6. 启动 watcher
  console.log('\n[3] 启动 fs.watch...');
  let changeCount = 0;
  const watcher = fs.watch(logPath, { persistent: true }, (eventType, filename) => {
    changeCount++;
    console.log(`\n✓ 检测到变化 [${changeCount}] (${eventType})`);
    onFileChanged();
  });
  console.log('✓ watcher 已启动');

  // 7. 定期检查文件大小
  let prevSize = initialStats.size;
  console.log('\n[4] 开始轮询检查 (每 500ms)...\n');

  const pollTimer = setInterval(() => {
    try {
      const stats = fs.statSync(logPath);
      if (stats.size !== prevSize) {
        console.log(`📝 文件大小变化: ${prevSize} → ${stats.size} (+${stats.size - prevSize} 字节)`);

        // 读取新内容
        const bytesToRead = stats.size - prevSize;
        if (bytesToRead > 0) {
          const buffer = Buffer.alloc(bytesToRead);
          const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, prevSize);
          const content = buffer.toString('utf-8', 0, bytesRead);
          console.log(`新内容:\n${content}`);
        }

        prevSize = stats.size;
      }
    } catch (error) {
      console.error('轮询错误:', error);
    }
  }, 500);

  // 8. 测试回调
  function onFileChanged() {
    console.log('  → watcher 回调触发');
  }

  console.log('等待 60 秒，请手动在 Minecraft 服务器中执行命令...\n');

  // 60 秒后停止
  setTimeout(() => {
    console.log('\n=== 测试结束 ===');
    console.log(`Watcher 触发次数: ${changeCount}`);
    clearInterval(pollTimer);
    watcher.close();
    fs.closeSync(fd);
    process.exit(0);
  }, 60000);
}

debugLogMonitor().catch(console.error);
