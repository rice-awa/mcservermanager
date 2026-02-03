/**
 * JWT 认证服务
 */
import jwt from 'jsonwebtoken';
import type { TokenPayload, AuthTokens, User } from '../types/auth';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SOCKET_TOKEN_EXPIRES_IN = process.env.SOCKET_TOKEN_EXPIRES_IN || '7d';

const DEMO_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: 'admin123',
    user: {
      id: 'user-001',
      username: 'admin',
      role: 'admin',
      createdAt: new Date(),
    },
  },
  user: {
    password: 'user123',
    user: {
      id: 'user-002',
      username: 'user',
      role: 'user',
      createdAt: new Date(),
    },
  },
};

export const authService = {
  validateUser(username: string, password: string): User | null {
    const found = DEMO_USERS[username];
    if (found && found.password === password) {
      return { ...found.user };
    }
    return null;
  },

  generateTokens(user: User): AuthTokens {
    const payload: Omit<TokenPayload, 'type'> = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const accessPayload = { ...payload, type: 'access' as const };
    const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const socketPayload = { ...payload, type: 'socket' as const };
    const socketToken = jwt.sign(socketPayload, JWT_SECRET, { expiresIn: SOCKET_TOKEN_EXPIRES_IN });

    const expiresIn = this.getExpiresInSeconds(JWT_EXPIRES_IN);

    return {
      accessToken,
      socketToken,
      expiresIn,
    };
  },

  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.warn('Token 验证失败', { error: (error as Error).message });
      return null;
    }
  },

  getExpiresInSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 86400;

    const value = parseInt(match[1] ?? '24', 10);
    const unit = match[2] ?? 'h';

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 86400;
    }
  },
};

export default authService;
