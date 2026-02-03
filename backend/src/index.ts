/**
 * MC Server Manager 后端入口文件
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';

import { loadConfig } from './config';
import { logger, errorHandler, notFoundHandler, createSuccessResponse } from './utils';
import { setupSocketHandlers } from './handlers';
import { configRoutes, playerRoutes, statsRoutes, authRoutes } from './routes';
import { socketAuthMiddleware } from './middleware/socket-auth.middleware';

// 加载配置
const config = loadConfig();

// 创建 Express 应用
const app = express();

// 创建 HTTP 服务器
const httpServer = createServer(app);

// 创建 Socket.io 服务器
const io = new SocketServer(httpServer, {
  cors: {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  },
});

// Socket.io 认证中间件
io.use(socketAuthMiddleware);

// 中间件配置
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json(createSuccessResponse({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date(),
  }));
});

// API 信息端点
app.get('/api', (req, res) => {
  res.json(createSuccessResponse({
    name: 'MC Server Manager API',
    version: '1.0.0',
    endpoints: [
      'GET /health - 健康检查',
      'GET /api - API 信息',
      'POST /api/auth/login - 用户登录',
      'GET /api/auth/me - 获取当前用户',
      'POST /api/auth/refresh - 刷新 token',
      'POST /api/auth/logout - 用户登出',
      'GET /api/configs - 获取配置列表',
      'POST /api/configs - 新建配置',
      'PUT /api/configs/:id - 更新配置',
      'DELETE /api/configs/:id - 删除配置',
      'POST /api/configs/:id/test - 测试连接',
      'GET /api/players - 获取玩家列表',
      'GET /api/players/count - 获取玩家数量',
      'GET /api/stats - 获取状态快照',
      'GET /api/stats/history - 获取历史数据',
      'WS / - WebSocket 连接 (支持 auth 事件)',
    ],
  }));
});

// ============ REST API 路由（对接文档 3 节） ============

// 认证 API
app.use('/api/auth', authRoutes);

// 配置管理 API (对接文档 3.1)
app.use('/api/configs', configRoutes);

// 玩家管理 API (对接文档 3.2)
app.use('/api/players', playerRoutes);

// 仪表盘数据 API (对接文档 3.3)
app.use('/api/stats', statsRoutes);

// 设置 WebSocket 处理器
setupSocketHandlers(io);

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
const { port, host } = config.server;

httpServer.listen(port, host, () => {
  logger.info(`服务器启动成功`);
  logger.info(`HTTP: http://${host}:${port}`);
  logger.info(`WebSocket: ws://${host}:${port}`);
  logger.info(`健康检查: http://${host}:${port}/health`);
  logger.info(`API 文档: http://${host}:${port}/api`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，准备关闭...');
  httpServer.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，准备关闭...');
  httpServer.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝', { reason });
});

export { app, httpServer, io };
