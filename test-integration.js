#!/usr/bin/env node
/**
 * 前后端集成测试脚本
 * 用于快速验证 API 和 WebSocket 是否正常工作
 */

const http = require('http');

const API_BASE_URL = 'http://localhost:3001';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log('green', `✓ ${message}`);
}

function error(message) {
  log('red', `✗ ${message}`);
}

function info(message) {
  log('blue', `ℹ ${message}`);
}

function warning(message) {
  log('yellow', `⚠ ${message}`);
}

// 测试 HTTP 请求
function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const url = `${API_BASE_URL}${path}`;
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          success(`${description} - 状态码 ${res.statusCode}`);
          resolve(true);
        } else {
          warning(`${description} - 状态码 ${res.statusCode}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      error(`${description} - ${err.message}`);
      resolve(false);
    });
  });
}

// 主测试流程
async function runTests() {
  console.log('\n========================================');
  info('开始测试后端服务');
  console.log('========================================\n');

  // 测试健康检查
  info('1. 测试健康检查端点');
  await testEndpoint('/health', '健康检查');
  console.log('');

  // 测试 API 信息
  info('2. 测试 API 信息端点');
  await testEndpoint('/api', 'API 信息');
  console.log('');

  // 测试配置管理
  info('3. 测试配置管理 API');
  await testEndpoint('/api/configs', '获取配置列表');
  console.log('');

  // 测试认证
  info('4. 测试认证 API');
  info('(未配置认证时可能返回错误，这是正常的)');
  await testEndpoint('/api/auth/me', '获取当前用户');
  console.log('');

  console.log('========================================');
  info('测试完成');
  console.log('========================================\n');

  console.log('下一步:');
  console.log('1. 如果所有测试通过，说明后端服务正常运行');
  console.log('2. 启动前端服务: npm run dev');
  console.log('3. 访问演示页面测试 API 和 WebSocket');
  console.log('4. 查看完整文档: QUICKSTART.md\n');
}

// 运行测试
runTests().catch((err) => {
  error(`测试失败: ${err.message}`);
  process.exit(1);
});
