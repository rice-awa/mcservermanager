/**
 * RCON 连接测试脚本
 * 使用方法: node test-rcon.js
 */
const io = require('socket.io-client');

// 连接到后端 WebSocket 服务器
const socket = io('http://localhost:3001');

// 测试配置
const testConfig = {
  name: 'Test Minecraft Server',
  host: 'localhost',  // 修改为你的 MC 服务器地址
  rconPort: 25575,    // 修改为你的 RCON 端口
  rconPassword: 'riceawa123456',  // 修改为你的 RCON 密码
  enabled: true,
};

socket.on('connect', () => {
  console.log('✅ 已连接到后端服务器');
  console.log('🔍 开始测试 RCON 连接...\n');

  // 测试连接
  socket.emit('server:test', { config: testConfig });
});

socket.on('server:testResult', (result) => {
  console.log('📊 测试结果:');
  console.log(`   成功: ${result.success ? '✅' : '❌'}`);
  console.log(`   消息: ${result.message}`);
  if (result.latency) {
    console.log(`   延迟: ${result.latency}ms`);
  }
  console.log('');

  if (result.success) {
    console.log('🎉 连接成功！现在测试发送命令...\n');

    // 添加服务器配置
    socket.emit('servers:add', { config: testConfig });
  } else {
    console.log('❌ 连接失败，请检查配置');
    process.exit(1);
  }
});

socket.on('servers:added', (data) => {
  const serverId = data.server.id;
  console.log(`✅ 服务器配置已添加: ${serverId}\n`);
  console.log('🔌 正在连接服务器...\n');

  // 连接到服务器
  socket.emit('server:connect', { serverId });
});

socket.on('server:status', (status) => {
  console.log(`📡 服务器状态: ${status.status}`);
  if (status.error) {
    console.log(`   错误: ${status.error}`);
  }

  if (status.status === 'connected') {
    console.log('✅ 服务器已连接！\n');
    console.log('📝 发送测试命令: list\n');

    // 发送测试命令
    socket.emit('console:command', {
      serverId: status.serverId,
      command: 'list',
    });
  }
});

socket.on('console:message', (message) => {
  console.log(`💬 [${message.type}] ${message.content}`);

  // 如果收到响应，再测试其他命令
  if (message.type === 'response' && message.content.includes('players')) {
    console.log('\n🎮 尝试更多命令...\n');

    setTimeout(() => {
      socket.emit('console:command', {
        serverId: message.serverId,
        command: 'tps',
      });
    }, 1000);
  }
});

socket.on('error', (error) => {
  console.error('❌ 错误:', error.message);
});

socket.on('disconnect', () => {
  console.log('🔌 已断开连接');
  process.exit(0);
});

// 10秒后自动退出
setTimeout(() => {
  console.log('\n⏱️  测试完成，断开连接...');
  socket.disconnect();
}, 10000);

console.log('🚀 启动 RCON 测试客户端...');
console.log('📋 配置信息:');
console.log(`   主机: ${testConfig.host}`);
console.log(`   端口: ${testConfig.rconPort}`);
console.log(`   密码: ${'*'.repeat(testConfig.rconPassword.length)}\n`);
