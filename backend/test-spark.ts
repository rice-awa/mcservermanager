/**
 * Spark Service 测试脚本
 * 用于验证 spark 命令解析功能
 *
 * 使用方法:
 * 1. 确保 MC 服务器运行中且 RCON 可连接
 * 2. 修改下方的服务器配置
 * 3. 运行: npx ts-node test-spark.ts
 */

import { Rcon } from 'rcon-client';

// ============ 服务器配置 ============
const SERVER_CONFIG = {
  host: 'localhost',
  port: 25575,        // RCON 端口
  password: 'your_rcon_password',  // 修改为你的 RCON 密码
};

// ============ 颜色代码清理 ============
function cleanColorCodes(text: string): string {
  let cleaned = text.replace(/§[0-9a-fk-or]/gi, '');
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  return cleaned.trim();
}

// ============ TPS 解析 ============
function parseTPSOutput(output: string): object | null {
  const cleaned = cleanColorCodes(output);
  console.log('\n[TPS] 清理后输出:', cleaned);

  // 匹配 TPS 数值
  const tpsMatch = cleaned.match(
    /TPS[^:]*:\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?/i
  );

  if (tpsMatch) {
    return {
      last5s: parseFloat(tpsMatch[1]) || 20,
      last10s: parseFloat(tpsMatch[2]) || 20,
      last1m: parseFloat(tpsMatch[3]) || 20,
      last5m: parseFloat(tpsMatch[4]) || 20,
      last15m: parseFloat(tpsMatch[5]) || 20,
    };
  }

  // 备用解析
  const numbers = cleaned.match(/[\d.]+/g);
  if (numbers && numbers.length >= 5) {
    return {
      last5s: parseFloat(numbers[0]) || 20,
      last10s: parseFloat(numbers[1]) || 20,
      last1m: parseFloat(numbers[2]) || 20,
      last5m: parseFloat(numbers[3]) || 20,
      last15m: parseFloat(numbers[4]) || 20,
    };
  }

  return null;
}

// ============ MSPT 解析 ============
function parseMSPTOutput(output: string): object | null {
  const cleaned = cleanColorCodes(output);

  const msptMatch = cleaned.match(
    /(?:Tick durations?|MSPT)[^:]*:\s*\*?([\d.]+)\*?\/\*?([\d.]+)\*?\/\*?([\d.]+)\*?\/\*?([\d.]+)\*?/i
  );

  if (msptMatch) {
    return {
      min: parseFloat(msptMatch[1]) || 0,
      median: parseFloat(msptMatch[2]) || 0,
      percentile95: parseFloat(msptMatch[3]) || 0,
      max: parseFloat(msptMatch[4]) || 0,
    };
  }

  return null;
}

// ============ Health 解析 ============
function parseHealthOutput(output: string): object {
  const cleaned = cleanColorCodes(output);
  console.log('\n[Health] 清理后输出:', cleaned);

  const result: Record<string, unknown> = {};

  // CPU Process
  const cpuProcessMatch = cleaned.match(
    /CPU\s*(?:Process|Usage)[^:]*:\s*\*?([\d.]+)%?\*?,?\s*\*?([\d.]+)%?\*?,?\s*\*?([\d.]+)%?\*?/i
  );
  if (cpuProcessMatch) {
    result.cpuProcess = {
      last10s: parseFloat(cpuProcessMatch[1]) || 0,
      last1m: parseFloat(cpuProcessMatch[2]) || 0,
      last15m: parseFloat(cpuProcessMatch[3]) || 0,
    };
  }

  // CPU System
  const cpuSystemMatch = cleaned.match(
    /CPU\s*System[^:]*:\s*\*?([\d.]+)%?\*?,?\s*\*?([\d.]+)%?\*?,?\s*\*?([\d.]+)%?\*?/i
  );
  if (cpuSystemMatch) {
    result.cpuSystem = {
      last10s: parseFloat(cpuSystemMatch[1]) || 0,
      last1m: parseFloat(cpuSystemMatch[2]) || 0,
      last15m: parseFloat(cpuSystemMatch[3]) || 0,
    };
  }

  // Memory
  const memoryMatch = cleaned.match(
    /Memory[^:]*:\s*([\d.]+)\s*[/]\s*([\d.]+)\s*(MB|GB)?/i
  );
  if (memoryMatch) {
    let used = parseFloat(memoryMatch[1]) || 0;
    let max = parseFloat(memoryMatch[2]) || 0;
    const unit = memoryMatch[3]?.toUpperCase();
    if (unit === 'GB') {
      used *= 1024;
      max *= 1024;
    }
    result.memory = { used: Math.round(used), max: Math.round(max) };
  }

  // Disk
  const diskMatch = cleaned.match(
    /Disk[^:]*:\s*([\d.]+)\s*[/]\s*([\d.]+)\s*(GB|TB)?/i
  );
  if (diskMatch) {
    let used = parseFloat(diskMatch[1]) || 0;
    let total = parseFloat(diskMatch[2]) || 0;
    const unit = diskMatch[3]?.toUpperCase();
    if (unit === 'TB') {
      used *= 1024;
      total *= 1024;
    }
    result.disk = { used, total };
  }

  return result;
}

// ============ 主测试函数 ============
async function main() {
  console.log('='.repeat(60));
  console.log('Spark Service 测试脚本');
  console.log('='.repeat(60));

  let rcon: Rcon | null = null;

  try {
    // 连接 RCON
    console.log('\n[1] 连接 RCON 服务器...');
    rcon = new Rcon({
      host: SERVER_CONFIG.host,
      port: SERVER_CONFIG.port,
      password: SERVER_CONFIG.password,
      timeout: 5000,
    });

    await rcon.connect();
    console.log('    连接成功!');

    // 测试 spark tps
    console.log('\n[2] 执行 spark tps 命令...');
    const tpsResponse = await rcon.send('spark tps');
    console.log('    原始输出:', tpsResponse);

    const tpsData = parseTPSOutput(tpsResponse);
    console.log('    解析结果:', JSON.stringify(tpsData, null, 2));

    const msptData = parseMSPTOutput(tpsResponse);
    console.log('    MSPT 解析:', JSON.stringify(msptData, null, 2));

    // 测试 spark health
    console.log('\n[3] 执行 spark health 命令...');
    const healthResponse = await rcon.send('spark health');
    console.log('    原始输出:', healthResponse);

    const healthData = parseHealthOutput(healthResponse);
    console.log('    解析结果:', JSON.stringify(healthData, null, 2));

    // 测试 list 命令
    console.log('\n[4] 执行 list 命令...');
    const listResponse = await rcon.send('list');
    console.log('    原始输出:', listResponse);

    const cleanedList = cleanColorCodes(listResponse);
    const playerMatch = cleanedList.match(/(\d+)\s*(?:of a max of|\/)\s*(\d+)/i);
    if (playerMatch) {
      console.log('    在线玩家:', playerMatch[1], '/', playerMatch[2]);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试完成!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n测试失败:', error);
  } finally {
    if (rcon) {
      rcon.end();
    }
  }
}

main();
