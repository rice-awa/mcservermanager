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
  password: 'riceawa123456',  // RCON 密码
};

// ============ 颜色代码清理 ============
function cleanColorCodes(text: string): string {
  let cleaned = text.replace(/§[0-9a-fk-or]/gi, '');
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  return cleaned.trim();
}

// ============ TPS 解析 ============
function safeParseFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseTPSOutput(output: string): object | null {
  const cleaned = cleanColorCodes(output);
  console.log('\n[TPS] 清理后输出:', cleaned);

  // 匹配 spark tps 输出格式:
  // [⚡] TPS from last 5s, 10s, 1m, 5m, 15m:
  // [⚡]  20.0, *20.0, *20.0, *20.0, *20.0
  const tpsMatch = cleaned.match(
    /TPS\s+from\s+last\s+5s[^:]*:\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?/i
  );

  if (tpsMatch && tpsMatch[1] && tpsMatch[2] && tpsMatch[3] && tpsMatch[4] && tpsMatch[5]) {
    return {
      last5s: safeParseFloat(tpsMatch[1], 20),
      last10s: safeParseFloat(tpsMatch[2], 20),
      last1m: safeParseFloat(tpsMatch[3], 20),
      last5m: safeParseFloat(tpsMatch[4], 20),
      last15m: safeParseFloat(tpsMatch[5], 20),
    };
  }

  // 备用解析：查找所有带 * 或不带 * 的数字
  const numbers = cleaned.match(/\*?[\d.]+/g);
  if (numbers && numbers.length >= 5) {
    // 清理 * 号
    const cleanNumbers = numbers.map(n => n.replace('*', ''));
    if (cleanNumbers[0] && cleanNumbers[1] && cleanNumbers[2] && cleanNumbers[3] && cleanNumbers[4]) {
      return {
        last5s: safeParseFloat(cleanNumbers[0], 20),
        last10s: safeParseFloat(cleanNumbers[1], 20),
        last1m: safeParseFloat(cleanNumbers[2], 20),
        last5m: safeParseFloat(cleanNumbers[3], 20),
        last15m: safeParseFloat(cleanNumbers[4], 20),
      };
    }
  }

  return null;
}

// ============ MSPT 解析 ============
function parseMSPTOutput(output: string): object | null {
  const cleaned = cleanColorCodes(output);

  // 匹配 spark tps 输出中的 MSPT:
  // [⚡] Tick durations (min/med/95%ile/max ms) from last 10s, 1m:
  // [⚡]  0.2/0.2/0.7/1.7;  0.2/0.3/1.3/269.0
  const msptMatch = cleaned.match(
    /Tick\s+durations[^:]*:\s*\*?([\d.]+)\*?\/\*?([\d.]+)\*?\/\*?([\d.]+)\*?\/\*?([\d.]+)\*?/i
  );

  if (msptMatch && msptMatch[1] && msptMatch[2] && msptMatch[3] && msptMatch[4]) {
    return {
      min: safeParseFloat(msptMatch[1], 0),
      median: safeParseFloat(msptMatch[2], 0),
      percentile95: safeParseFloat(msptMatch[3], 0),
      max: safeParseFloat(msptMatch[4], 0),
    };
  }

  // 备用：查找 x/x/x/x 格式的数字
  const msptLine = cleaned.match(/([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
  if (msptLine && msptLine[1] && msptLine[2] && msptLine[3] && msptLine[4]) {
    return {
      min: safeParseFloat(msptLine[1], 0),
      median: safeParseFloat(msptLine[2], 0),
      percentile95: safeParseFloat(msptLine[3], 0),
      max: safeParseFloat(msptLine[4], 0),
    };
  }

  return null;
}

// ============ Health 解析 ============
function parseHealthOutput(output: string): object {
  const cleaned = cleanColorCodes(output);
  console.log('\n[Health] 清理后输出:', cleaned);

  const result: Record<string, unknown> = {};

  // CPU usage from spark tps output:
  // [⚡] CPU usage from last 10s, 1m, 15m:
  // [⚡]  30%, 29%, 48%  (system)
  // [⚡]  2%, 1%, 2%  (process)

  // CPU System - 匹配 system 行
  const cpuSystemMatch = cleaned.match(
    /([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\(system\)/i
  );
  if (cpuSystemMatch && cpuSystemMatch[1] && cpuSystemMatch[2] && cpuSystemMatch[3]) {
    result.cpuSystem = {
      last10s: safeParseFloat(cpuSystemMatch[1], 0),
      last1m: safeParseFloat(cpuSystemMatch[2], 0),
      last15m: safeParseFloat(cpuSystemMatch[3], 0),
    };
  }

  // CPU Process - 匹配 process 行
  const cpuProcessMatch = cleaned.match(
    /([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\(process\)/i
  );
  if (cpuProcessMatch && cpuProcessMatch[1] && cpuProcessMatch[2] && cpuProcessMatch[3]) {
    result.cpuProcess = {
      last10s: safeParseFloat(cpuProcessMatch[1], 0),
      last1m: safeParseFloat(cpuProcessMatch[2], 0),
      last15m: safeParseFloat(cpuProcessMatch[3], 0),
    };
  }

  // Memory - spark healthreport 格式
  const memoryMatch = cleaned.match(
    /Memory[^:]*:\s*([\d.]+)\s*[/]\s*([\d.]+)\s*(MB|GB)?/i
  );
  if (memoryMatch && memoryMatch[1] && memoryMatch[2]) {
    let used = safeParseFloat(memoryMatch[1], 0);
    let max = safeParseFloat(memoryMatch[2], 0);
    const unit = memoryMatch[3]?.toUpperCase();
    if (unit === 'GB') {
      used *= 1024;
      max *= 1024;
    }
    result.memory = { used: Math.round(used), max: Math.round(max) };
  }

  // Disk - spark healthreport 格式
  const diskMatch = cleaned.match(
    /Disk[^:]*:\s*([\d.]+)\s*[/]\s*([\d.]+)\s*(GB|TB)?/i
  );
  if (diskMatch && diskMatch[1] && diskMatch[2]) {
    let used = safeParseFloat(diskMatch[1], 0);
    let total = safeParseFloat(diskMatch[2], 0);
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
    console.log('    原始输出:', JSON.stringify(tpsResponse));

    const tpsData = parseTPSOutput(tpsResponse);
    console.log('    TPS 解析结果:', JSON.stringify(tpsData, null, 2));

    const msptData = parseMSPTOutput(tpsResponse);
    console.log('    MSPT 解析:', JSON.stringify(msptData, null, 2));

    // 测试 spark healthreport
    console.log('\n[3] 执行 spark healthreport 命令...');
    const healthResponse = await rcon.send('spark healthreport');
    console.log('    原始输出:', JSON.stringify(healthResponse));

    const healthData = parseHealthOutput(healthResponse);
    console.log('    解析结果:', JSON.stringify(healthData, null, 2));

    // 测试 list 命令
    console.log('\n[4] 执行 list 命令...');
    const listResponse = await rcon.send('list');
    console.log('    原始输出:', listResponse);

    const cleanedList = cleanColorCodes(listResponse);
    const playerMatch = cleanedList.match(/(\d+)\s*(?:of a max of|\/)\s*(\d+)/i);
    if (playerMatch && playerMatch[1] && playerMatch[2]) {
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
