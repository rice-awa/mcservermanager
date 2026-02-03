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

// API 路由占位
app.get('/api', (req, res) => {
  res.json(createSuccessResponse({
    name: 'MC Server Manager API',
    version: '1.0.0',
    endpoints: [
      'GET /health - 健康检查',
      'GET /api - API 信息',
      'WS / - WebSocket 连接',
    ],
  }));
});

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
