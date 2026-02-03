/**
 * 测试日志文件实时监听
 */
import * as fs from 'fs';

const logFile = 'D:\\MCTESTSERVER\\1.21.11\\logs\\latest.log';

console.log('开始监听日志文件...\n');

let position = fs.statSync(logFile).size;
console.log(`初始位置: ${position} 字节\n`);

const interval = setInterval(() => {
  const stats = fs.statSync(logFile);
  const newSize = stats.size;

  if (newSize > position) {
    const fd = fs.openSync(logFile, 'r');
    const bytesToRead = newSize - position;
    const buffer = Buffer.alloc(bytesToRead);
    fs.readSync(fd, buffer, 0, bytesToRead, position);
    fs.closeSync(fd);

    const content = buffer.toString('utf-8');
    console.log('=== 新日志内容 ===');
    console.log(content);
    console.log('==================\n');

    position = newSize;
  }
}, 200);

console.log('监听中... (按 Ctrl+C 停止)');
console.log('请在服务器执行一些命令测试\n');

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n监听已停止');
  process.exit(0);
});
