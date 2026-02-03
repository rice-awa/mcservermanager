import { Rcon } from 'rcon-client';

async function test() {
  const rcon = new Rcon({
    host: 'localhost',
    port: 25575,
    password: 'riceawa123456',
    timeout: 5000,
  });

  await rcon.connect();

  // 测试多个命令
  const commands = ['spark', 'spark tps', 'spark healthreport', 'help', 'list'];

  for (const cmd of commands) {
    console.log('\n========================================');
    console.log('命令:', cmd);
    console.log('========================================');
    const result = await rcon.send(cmd);
    console.log('返回:', JSON.stringify(result));
    console.log('长度:', result.length);
  }

  rcon.end();
}

test().catch(console.error);
