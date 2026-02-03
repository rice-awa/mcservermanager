import { Rcon } from 'rcon-client';

async function test() {
  const rcon = new Rcon({
    host: 'localhost',
    port: 25575,
    password: 'riceawa123456',
    timeout: 5000,
  });

  await rcon.connect();
  console.log('RCON 连接成功');

  console.log('\n发送命令: list');
  const result = await rcon.send('list');
  console.log('响应:', result);

  console.log('\n发送命令: spark tps');
  const tps = await rcon.send('spark tps');
  console.log('响应:', tps);

  console.log('\n等待 3 秒...');
  await new Promise(r => setTimeout(r, 3000));

  rcon.end();
  console.log('\n请检查服务器日志: D:\\MCTESTSERVER\\1.21.11\\logs\\latest.log');
  console.log('查看命令: Get-Content "D:\\MCTESTSERVER\\1.21.11\\logs\\latest.log" -Tail 20');
}

test().catch(console.error);
