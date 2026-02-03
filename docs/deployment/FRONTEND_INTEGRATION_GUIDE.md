# 前端集成指南

本文档说明如何在前端页面中集成后端 API 和 WebSocket 服务。

## 1. 已完成的基础服务

### 1.1 API 客户端服务 (`src/services/api.service.ts`)

封装了所有 REST API 调用:

```typescript
import { 
  getConfigs,
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  testConnection,
  getPlayers,
  getPlayerCount,
  getStats,
  getStatsHistory,
  checkHealth
} from '@/services/api.service';
```

### 1.2 WebSocket 服务 (`src/services/socket.service.ts`)

封装了 Socket.IO 连接和事件处理:

```typescript
import { socketService } from '@/services/socket.service';

// 连接到 WebSocket 服务器
socketService.connect({
  onConnect: () => console.log('Connected'),
  onDisconnect: (reason) => console.log('Disconnected:', reason),
  onConsoleMessage: (message) => console.log('Console:', message),
  onStatsUpdate: (stats) => console.log('Stats:', stats),
  onPlayerUpdate: (players) => console.log('Players:', players),
});

// 连接到 MC 服务器
socketService.connectToServer(serverId);

// 执行命令
socketService.executeCommand(serverId, 'list');

// 订阅状态更新
socketService.subscribeStats(serverId);
```

## 2. 环境配置

已创建 `.env.local` 文件,配置了 API 和 WebSocket 地址:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

## 3. 页面集成步骤

### 3.1 设置页面 (SettingsPage.tsx)

**需要修改的功能:**

1. **加载配置列表**
   - 替换 `getMockConnectionConfigs()` 为 `getConfigs()`
   - 在组件挂载时从后端获取配置

2. **新建/更新配置**
   - 使用 `createConfig()` 和 `updateConfig()` API

3. **删除配置**
   - 使用 `deleteConfig()` API

4. **测试连接**
   - 使用 `testConnection()` API 或 `socketService.testConnection()`

**示例代码:**

```typescript
import { useEffect, useState } from 'react';
import { getConfigs, createConfig, updateConfig, deleteConfig, testConnection } from '@/services/api.service';

// 加载配置列表
useEffect(() => {
  async function loadConfigs() {
    try {
      const configs = await getConfigs();
      setConfigs(configs);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }
  loadConfigs();
}, []);

// 保存配置
const handleSave = async () => {
  try {
    if (editingId) {
      await updateConfig(editingId, formData);
    } else {
      await createConfig(formData);
    }
    // 重新加载配置列表
    const configs = await getConfigs();
    setConfigs(configs);
  } catch (error) {
    console.error('保存配置失败:', error);
  }
};

// 测试连接
const handleTest = async (configId: string) => {
  try {
    const result = await testConnection(configId);
    console.log('测试结果:', result);
  } catch (error) {
    console.error('测试连接失败:', error);
  }
};
```

### 3.2 控制台页面 (ConsolePage.tsx)

**需要修改的功能:**

1. **连接 WebSocket**
   - 在组件挂载时连接到 WebSocket 服务器
   - 监听控制台消息输出

2. **发送命令**
   - 使用 `socketService.executeCommand()` 发送命令

3. **接收消息**
   - 通过 `onConsoleMessage` 回调接收并显示消息

**示例代码:**

```typescript
import { useEffect, useState } from 'react';
import { socketService } from '@/services/socket.service';
import type { ConsoleMessage } from '@/types';

const [serverId] = useState('server-1'); // 从路由或全局状态获取

useEffect(() => {
  // 连接到 WebSocket
  socketService.connect({
    onConsoleMessage: (message) => {
      setMessages(prev => [...prev, message]);
    },
  });

  // 连接到 MC 服务器
  socketService.connectToServer(serverId);

  return () => {
    socketService.disconnectFromServer(serverId);
  };
}, [serverId]);

// 发送命令
const handleSend = () => {
  const command = inputValue.trim();
  if (!command) return;

  socketService.executeCommand(serverId, command);
  setInputValue('');
};
```

### 3.3 仪表盘页面 (DashboardPage.tsx)

**需要修改的功能:**

1. **获取初始数据**
   - 使用 `getStats()` 获取当前快照
   - 使用 `getStatsHistory()` 获取历史数据

2. **实时订阅**
   - 使用 `socketService.subscribeStats()` 订阅状态更新
   - 通过 `onStatsUpdate` 回调接收并更新数据

**示例代码:**

```typescript
import { useEffect, useState } from 'react';
import { getStats, getStatsHistory } from '@/services/api.service';
import { socketService } from '@/services/socket.service';
import type { ServerStats, TPSData } from '@/types';

const [serverId] = useState('server-1');
const [stats, setStats] = useState<ServerStats | null>(null);

useEffect(() => {
  // 加载初始数据
  async function loadData() {
    try {
      const [statsData, historyData] = await Promise.all([
        getStats(serverId),
        getStatsHistory(serverId)
      ]);
      setStats(statsData);
      setTpsHistory(historyData.tpsHistory);
      setCpuHistory(historyData.cpuHistory);
      setMemoryHistory(historyData.memoryHistory);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }

  loadData();

  // 连接 WebSocket 并订阅实时更新
  socketService.connect({
    onStatsUpdate: (newStats) => {
      setStats(newStats);
      // 更新历史数据
      setTpsHistory(prev => [...prev.slice(1), { 
        timestamp: Date.now(), 
        tps: newStats.tps 
      }]);
    },
  });

  socketService.subscribeStats(serverId);

  return () => {
    socketService.unsubscribeStats(serverId);
  };
}, [serverId]);
```

### 3.4 玩家页面 (PlayersPage.tsx)

**需要修改的功能:**

1. **加载玩家列表**
   - 使用 `getPlayers()` API,支持筛选和分页

2. **实时更新**
   - 通过 `onPlayerUpdate` 回调接收玩家列表更新

**示例代码:**

```typescript
import { useEffect, useState } from 'react';
import { getPlayers } from '@/services/api.service';
import { socketService } from '@/services/socket.service';
import type { Player } from '@/types';

const [serverId] = useState('server-1');
const [players, setPlayers] = useState<Player[]>([]);
const [total, setTotal] = useState(0);

useEffect(() => {
  // 加载玩家列表
  async function loadPlayers() {
    try {
      const result = await getPlayers(serverId, {
        q: query,
        status: statusFilter,
        page,
        pageSize,
        sortBy: sortKey,
        sortOrder: sortDirection,
      });
      setPlayers(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('加载玩家列表失败:', error);
    }
  }

  loadPlayers();

  // 订阅玩家列表更新
  socketService.connect({
    onPlayerUpdate: (updatedPlayers) => {
      setPlayers(updatedPlayers);
    },
  });

  return () => {
    // 清理
  };
}, [serverId, query, statusFilter, page, pageSize, sortKey, sortDirection]);
```

## 4. 全局状态管理建议

为了更好地管理当前选中的服务器和连接状态,建议使用 Context 或状态管理库(如 Zustand):

```typescript
// src/store/server.store.ts
import { create } from 'zustand';
import type { ServerConfig, ConnectionStatus } from '@/types';

interface ServerStore {
  currentServerId: string | null;
  currentConfig: ServerConfig | null;
  connectionStatus: ConnectionStatus;
  setCurrentServer: (id: string, config: ServerConfig) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  currentServerId: null,
  currentConfig: null,
  connectionStatus: 'disconnected',
  setCurrentServer: (id, config) => set({ currentServerId: id, currentConfig: config }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
```

## 5. 错误处理

所有 API 调用都可能抛出 `ApiError`,建议统一处理:

```typescript
import { ApiError } from '@/services/api.service';

try {
  const data = await getConfigs();
  // 处理数据
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API 错误:', error.message, error.code);
    // 显示用户友好的错误提示
  } else {
    console.error('未知错误:', error);
  }
}
```

## 6. 测试步骤

1. 启动后端服务:
   ```bash
   cd backend
   npm run dev
   ```

2. 启动前端服务:
   ```bash
   npm run dev
   ```

3. 访问 http://localhost:5173 测试各功能

4. 检查浏览器控制台和网络面板,确认 API 调用和 WebSocket 连接正常

## 7. 下一步工作

- [ ] 在 SettingsPage 中集成配置管理 API
- [ ] 在 ConsolePage 中集成 WebSocket 命令发送
- [ ] 在 DashboardPage 中集成状态订阅
- [ ] 在 PlayersPage 中集成玩家列表 API
- [ ] 添加全局状态管理(可选)
- [ ] 添加错误提示组件
- [ ] 添加加载状态指示器
- [ ] 完善类型定义
