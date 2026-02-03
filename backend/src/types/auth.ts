/**
 * JWT 认证类型定义
 */

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  type: 'access' | 'socket';
}

export interface AuthTokens {
  accessToken: string;
  socketToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  success: true;
  data: {
    user: Omit<User, 'password'>;
    tokens: AuthTokens;
  };
}

export interface AuthenticatedRequest {
  user: TokenPayload;
}
