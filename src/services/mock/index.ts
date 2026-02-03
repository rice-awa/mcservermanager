// Mock 数据服务（用于原型开发）
export * from './console'
export * from './dashboard'
export * from './players'
export * from './connections'

// 真实 API 服务
export * from '../api.service'

// WebSocket 服务
export { socketService, default as socket } from '../socket.service'

