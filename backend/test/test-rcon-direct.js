/**
 * 直接测试 RCON 连接
 * 不通过 WebSocket，直接连接 MC 服务器
 */
const { Rcon } = require('rcon-client');

const config = {
  host: 'localhost',
  port: 25575,
  password: 'riceawa123456',
  timeout: 5000,
};

console.log('🚀 开始测试 RCON 连接...');
console.log('📋 配置信息:');
console.log(`   主机: ${config.host}`);
console.log(`   端口: ${config.port}`);
console.log(`   密码: ${'*'.repeat(config.password.length)}`);
console.log(`   超时: ${config.timeout}ms\n`);

async function test() {
  const startTime = Date.now();
  let rcon;

  try {
    console.log('🔌 正在连接...');
    rcon = new Rcon(config);

    // 监听事件
    rcon.on('connect', () => {
      console.log('✅ TCP 连接建立');
    });

    rcon.on('authenticated', () => {
      console.log('✅ RCON 认证成功');
    });

    rcon.on('error', (error) => {
      console.error('❌ RCON 错误:', error.message);
    });

    rcon.on('end', () => {
      console.log('🔌 连接已关闭');
    });

    // 连接
    await rcon.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ 连接成功！耗时: ${connectTime}ms\n`);

    // 测试命令
    console.log('📝 测试命令: list');
    const cmdStart = Date.now();
    const response = await rcon.send('list');
    const cmdTime = Date.now() - cmdStart;

    console.log(`✅ 命令执行成功！耗时: ${cmdTime}ms`);
    console.log(`📊 响应内容:\n${response}\n`);

    // 测试更多命令
    console.log('📝 测试命令: tps');
    const tpsResponse = await rcon.send('tps');
    console.log(`📊 TPS 响应:\n${tpsResponse}\n`);

    console.log('📝 测试命令: seed');
    const seedResponse = await rcon.send('seed');
    console.log(`📊 种子响应:\n${seedResponse}\n`);

    // 关闭连接
    console.log('🔌 关闭连接...');
    rcon.end();

    console.log('\n🎉 所有测试通过！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败！');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:\n', error.stack);

    if (rcon) {
      try {
        rcon.end();
      } catch {
        // 忽略
      }
    }

    process.exit(1);
  }
}

test();
