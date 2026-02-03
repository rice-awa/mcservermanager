/**
 * 服务器配置管理服务
 * 管理 Minecraft 服务器配置的增删改查
 */
import type { ServerConfig } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConfigService');

export class ConfigService {
  // 内存中的配置存储（后续可改为文件或数据库）
  private configs: Map<string, ServerConfig> = new Map();

  constructor() {
    // 初始化时可以添加默认配置或从文件加载
    this.loadDefaultConfigs();
  }

  /**
   * 加载默认配置（示例）
   */
  private loadDefaultConfigs(): void {
    // 这里可以从文件或环境变量加载默认配置
    logger.info('配置服务初始化完成');
  }

  /**
   * 获取所有配置
   */
  getAll(): ServerConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * 获取单个配置
   */
  get(id: string): ServerConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * 创建配置
   */
  create(config: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>): ServerConfig {
    const id = this.generateId();
    const now = new Date();

    const newConfig: ServerConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.configs.set(id, newConfig);
    logger.info(`创建服务器配置: ${newConfig.name} (${id})`);

    return newConfig;
  }

  /**
   * 更新配置
   */
  update(id: string, updates: Partial<Omit<ServerConfig, 'id' | 'createdAt'>>): ServerConfig | undefined {
    const existing = this.configs.get(id);
    if (!existing) {
      logger.warn(`配置不存在: ${id}`);
      return undefined;
    }

    const updatedConfig: ServerConfig = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    this.configs.set(id, updatedConfig);
    logger.info(`更新服务器配置: ${updatedConfig.name} (${id})`);

    return updatedConfig;
  }

  /**
   * 删除配置
   */
  delete(id: string): boolean {
    const existing = this.configs.get(id);
    if (!existing) {
      logger.warn(`配置不存在: ${id}`);
      return false;
    }

    this.configs.delete(id);
    logger.info(`删除服务器配置: ${existing.name} (${id})`);
    return true;
  }

  /**
   * 检查配置是否存在
   */
  exists(id: string): boolean {
    return this.configs.has(id);
  }

  /**
   * 获取启用的配置
   */
  getEnabled(): ServerConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.enabled);
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `srv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const configService = new ConfigService();
export default configService;
