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

  console.log('========================================');
  console.log('测试 1: 执行 spark tps，然后立即执行 list');
  console.log('========================================');
  
  const spark1 = await rcon.send('spark tps');
  console.log(`spark tps 返回: "${spark1}" (长度: ${spark1.length})`);
  
  // 不等待，立即执行下一个命令
  const list1 = await rcon.send('list');
  console.log(`list 返回: "${list1}" (长度: ${list1.length})`);
  console.log(`list 内容:\n${list1}`);
  
  console.log('\n========================================');
  console.log('测试 2: 执行 spark tps，等待 1 秒，再执行 list');
  console.log('========================================');
  
  const spark2 = await rcon.send('spark tps');
  console.log(`spark tps 返回: "${spark2}" (长度: ${spark2.length})`);
  
  await new Promise(r => setTimeout(r, 1000));
  
  const list2 = await rcon.send('list');
  console.log(`list 返回: "${list2}" (长度: ${list2.length})`);
  console.log(`list 内容:\n${list2}`);
  
  console.log('\n========================================');
  console.log('测试 3: 连续执行多个 spark 命令');
  console.log('========================================');
  
  await rcon.send('spark tps');
  await rcon.send('spark healthreport');
  await rcon.send('spark gc');
  
  await new Promise(r => setTimeout(r, 500));
  
  const help = await rcon.send('help');
  console.log(`help 返回长度: ${help.length}`);
  console.log(`help 前 200 字符: ${help.substring(0, 200)}`);

  rcon.end();
  console.log('\n测试完成');
}

test().catch(console.error);
