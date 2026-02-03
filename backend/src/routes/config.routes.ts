/**
 * 配置管理 REST API 路由
 * 对应对接文档 3.1 节
 */
import { Router, Request, Response } from 'express';
import type { ServerConfig, ApiResponse, ApiSuccessResponse, ApiErrorResponse, TestConnectionResult } from '../types';
import { configService } from '../services/config.service';
import { rconService } from '../services/rcon.service';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('ConfigRoutes');

/**
 * GET /api/configs - 获取配置列表
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const configs = configService.getAll();
    const response: ApiSuccessResponse<ServerConfig[]> = {
      success: true,
      data: configs,
    };
    res.json(response);
  } catch (error) {
    logger.error('获取配置列表失败', { error });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'FETCH_CONFIGS_FAILED',
        message: '获取配置列表失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/configs/:id - 获取单个配置
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!id) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'MISSING_ID',
          message: '缺少配置 ID',
        },
      };
      return res.status(400).json(response);
    }

    const config = configService.get(id);

    if (!config) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: `配置不存在: ${id}`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiSuccessResponse<ServerConfig> = {
      success: true,
      data: config,
    };
    res.json(response);
  } catch (error) {
    logger.error('获取配置失败', { error });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'FETCH_CONFIG_FAILED',
        message: '获取配置失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/configs - 新建配置
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const configData: Omit<ServerConfig, 'id'> = req.body;

    // 验证必填字段
    if (!configData.name || !configData.host || !configData.port || !configData.password) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CONFIG',
          message: '缺少必填字段: name, host, port, password',
        },
      };
      return res.status(400).json(response);
    }

    const newConfig = configService.create(configData);
    const response: ApiSuccessResponse<ServerConfig> = {
      success: true,
      data: newConfig,
      message: '配置创建成功',
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('创建配置失败', { error });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'CREATE_CONFIG_FAILED',
        message: '创建配置失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/configs/:id - 更新配置
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!id) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'MISSING_ID',
          message: '缺少配置 ID',
        },
      };
      return res.status(400).json(response);
    }

    const updates: Partial<Omit<ServerConfig, 'id'>> = req.body;

    const updatedConfig = configService.update(id, updates);

    if (!updatedConfig) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: `配置不存在: ${id}`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiSuccessResponse<ServerConfig> = {
      success: true,
      data: updatedConfig,
      message: '配置更新成功',
    };
    res.json(response);
  } catch (error) {
    logger.error('更新配置失败', { error });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'UPDATE_CONFIG_FAILED',
        message: '更新配置失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/configs/:id - 删除配置
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!id) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'MISSING_ID',
          message: '缺少配置 ID',
        },
      };
      return res.status(400).json(response);
    }

    // 先断开连接（如果已连接）
    if (rconService.isConnected(id)) {
      rconService.disconnect(id);
    }

    const deleted = configService.delete(id);

    if (!deleted) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: `配置不存在: ${id}`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiSuccessResponse = {
      success: true,
      message: '配置删除成功',
    };
    res.json(response);
  } catch (error) {
    logger.error('删除配置失败', { error });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'DELETE_CONFIG_FAILED',
        message: '删除配置失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/configs/:id/test - 测试连接
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    // 如果提供了 id，使用已保存的配置
    // 如果请求体包含完整配置，使用请求体配置
    let testConfig: ServerConfig;

    if (id && id !== 'test' && id !== 'new') {
      const config = configService.get(id);
      if (!config) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: `配置不存在: ${id}`,
          },
        };
        return res.status(404).json(response);
      }
      testConfig = config;
    } else {
      // 使用请求体中的配置进行测试
      testConfig = {
        id: 'test',
        name: req.body.name || 'Test',
        host: req.body.host || 'localhost',
        port: req.body.port || 25575,
        password: req.body.password || '',
        timeout: req.body.timeout,
        sparkApiUrl: req.body.sparkApiUrl,
      };
    }

    const result = await rconService.testConnection(testConfig);

    if (result.success) {
      const response: ApiSuccessResponse<TestConnectionResult> = {
        success: true,
        data: result,
        message: result.message,
      };
      res.json(response);
    } else {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: result.message,
        },
      };
      res.json(response);
    }
  } catch (error) {
    logger.error('测试连接失败', { error });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'TEST_CONNECTION_FAILED',
        message: '测试连接失败',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
