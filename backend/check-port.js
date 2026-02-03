/**
 * 检查端口是否开放
 */
const net = require('net');

function checkPort(host, port) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = 3000;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      console.log(`✅ 端口 ${port} 是开放的`);
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      console.log(`⏱️  端口 ${port} 连接超时`);
      socket.destroy();
      reject(new Error('timeout'));
    });

    socket.on('error', (err) => {
      console.log(`❌ 端口 ${port} 连接失败: ${err.message}`);
      reject(err);
    });

    console.log(`🔍 检查 ${host}:${port}...`);
    socket.connect(port, host);
  });
}

async function main() {
  console.log('🚀 开始端口检测...\n');

  // 检查 RCON 端口
  try {
    await checkPort('localhost', 25575);
  } catch (error) {
    console.log('\n💡 可能的原因:');
    console.log('   1. Minecraft 服务器未运行');
    console.log('   2. server.properties 中 enable-rcon=false');
    console.log('   3. rcon.port 配置错误');
    console.log('   4. 防火墙阻止了该端口');
    console.log('\n📝 请检查:');
    console.log('   - server.properties 中确认 enable-rcon=true');
    console.log('   - 确认 rcon.port=25575');
    console.log('   - 重启 MC 服务器使配置生效');
    process.exit(1);
  }

  console.log('\n✅ 端口检测通过！');
  console.log('现在可以尝试 RCON 连接');
  process.exit(0);
}

main();
