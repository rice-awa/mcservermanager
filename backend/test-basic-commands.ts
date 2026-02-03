import { Rcon } from 'rcon-client';

async function test() {
  const rcon = new Rcon({
    host: 'localhost',
    port: 25575,
    password: 'riceawa123456',
    timeout: 5000,
  });

  await rcon.connect();
  console.log('RCON 连接成功!\n');

  // 测试各种普通命令
  const commands = [
    'list',
    'seed',
    'time query daytime',
    'difficulty',
    'gamerule',
    'weather query',
    'help spark',
  ];

  for (const cmd of commands) {
    console.log('========================================');
    console.log(`命令: ${cmd}`);
    console.log('========================================');
    
    try {
      const result = await rcon.send(cmd);
      console.log(`返回长度: ${result.length} 字符`);
      console.log(`原始输出:\n${result}`);
      console.log(`JSON 格式: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error(`错误: ${error}`);
    }
    
    console.log('\n');
  }

  rcon.end();
  console.log('测试完成');
}

test().catch(console.error);
