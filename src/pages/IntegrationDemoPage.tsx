/**
 * 集成演示页面
 * 展示如何使用 API 和 WebSocket 服务
 */
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { 
  getConfigs, 
  getStats, 
  getPlayers,
  checkHealth,
  ApiError 
} from '@/services/api.service'
import { socketService } from '@/services/socket.service'
import type { 
  ServerConfig, 
  ServerStats, 
  Player, 
  ConsoleMessage,
  ConnectionStatus 
} from '@/types'

export default function IntegrationDemoPage() {
  // API 状态
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [configs, setConfigs] = useState<ServerConfig[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // WebSocket 状态
  const [wsConnected, setWsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected');
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);

  // 检查 API 健康状态
  useEffect(() => {
    checkHealth()
      .then(healthy => setApiHealthy(healthy))
      .catch(() => setApiHealthy(false));
  }, []);

  // 连接 WebSocket
  useEffect(() => {
    socketService.connect({
      onConnect: () => {
        console.log('[Demo] WebSocket connected');
        setWsConnected(true);
      },
      onDisconnect: (reason) => {
        console.log('[Demo] WebSocket disconnected:', reason);
        setWsConnected(false);
      },
      onError: (error) => {
        console.error('[Demo] WebSocket error:', error);
      },
      onConsoleMessage: (message) => {
        console.log('[Demo] Console message:', message);
        setConsoleMessages(prev => [...prev, message].slice(-20)); // 保留最近20条
      },
      onStatsUpdate: (newStats) => {
        console.log('[Demo] Stats update:', newStats);
        setStats(newStats);
      },
      onPlayerUpdate: (newPlayers) => {
        console.log('[Demo] Player update:', newPlayers);
        setPlayers(newPlayers);
      },
      onConnectionStatus: (status, message) => {
        console.log('[Demo] Connection status:', status, message);
        setWsStatus(status);
      },
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  // 加载配置列表
  const handleLoadConfigs = async () => {
    try {
      setApiError(null);
      const data = await getConfigs();
      setConfigs(data);
      console.log('[Demo] Loaded configs:', data);
    } catch (error) {
      const message = error instanceof ApiError 
        ? `${error.message} (${error.code})` 
        : '加载配置失败';
      setApiError(message);
      console.error('[Demo] Load configs error:', error);
    }
  };

  // 加载服务器状态
  const handleLoadStats = async () => {
    if (!currentServerId) {
      setApiError('请先选择服务器');
      return;
    }

    try {
      setApiError(null);
      const data = await getStats(currentServerId);
      setStats(data);
      console.log('[Demo] Loaded stats:', data);
    } catch (error) {
      const message = error instanceof ApiError 
        ? `${error.message} (${error.code})` 
        : '加载状态失败';
      setApiError(message);
      console.error('[Demo] Load stats error:', error);
    }
  };

  // 加载玩家列表
  const handleLoadPlayers = async () => {
    if (!currentServerId) {
      setApiError('请先选择服务器');
      return;
    }

    try {
      setApiError(null);
      const data = await getPlayers(currentServerId, {
        page: 1,
        pageSize: 10,
      });
      setPlayers(data.items);
      console.log('[Demo] Loaded players:', data);
    } catch (error) {
      const message = error instanceof ApiError 
        ? `${error.message} (${error.code})` 
        : '加载玩家列表失败';
      setApiError(message);
      console.error('[Demo] Load players error:', error);
    }
  };

  // 连接到服务器
  const handleConnectServer = (serverId: string) => {
    setCurrentServerId(serverId);
    socketService.connectToServer(serverId);
    console.log('[Demo] Connecting to server:', serverId);
  };

  // 断开服务器连接
  const handleDisconnectServer = () => {
    if (currentServerId) {
      socketService.disconnectFromServer(currentServerId);
      setCurrentServerId(null);
      console.log('[Demo] Disconnected from server');
    }
  };

  // 订阅状态更新
  const handleSubscribeStats = () => {
    if (!currentServerId) {
      setApiError('请先连接服务器');
      return;
    }
    socketService.subscribeStats(currentServerId);
    console.log('[Demo] Subscribed to stats:', currentServerId);
  };

  // 发送命令
  const handleSendCommand = (command: string) => {
    if (!currentServerId) {
      setApiError('请先连接服务器');
      return;
    }
    socketService.executeCommand(currentServerId, command);
    console.log('[Demo] Sent command:', command);
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">集成演示</h1>
        <p className="mt-2 text-muted-foreground">
          展示 API 和 WebSocket 服务的使用方法
        </p>
      </div>

      {/* API 健康状态 */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-3">后端服务状态</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">API:</span>
            <Badge variant={apiHealthy ? 'default' : 'destructive'}>
              {apiHealthy === null ? '检测中...' : apiHealthy ? '在线' : '离线'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">WebSocket:</span>
            <Badge variant={wsConnected ? 'default' : 'destructive'}>
              {wsConnected ? '已连接' : '未连接'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">服务器状态:</span>
            <Badge variant={wsStatus === 'connected' ? 'default' : 'secondary'}>
              {wsStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {apiError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{apiError}</p>
        </div>
      )}

      {/* REST API 演示 */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-3">REST API 测试</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            onClick={handleLoadConfigs}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            加载配置列表
          </button>
          <button 
            onClick={handleLoadStats}
            disabled={!currentServerId}
            className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            加载服务器状态
          </button>
          <button 
            onClick={handleLoadPlayers}
            disabled={!currentServerId}
            className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            加载玩家列表
          </button>
        </div>

        {/* 配置列表 */}
        {configs.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">配置列表 ({configs.length})</h3>
            <div className="space-y-2">
              {configs.map(config => (
                <div 
                  key={config.id}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div>
                    <div className="font-medium">{config.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {config.host}:{config.port}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleConnectServer(config.id)}
                    disabled={currentServerId === config.id}
                    className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    {currentServerId === config.id ? '已选择' : '选择'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 服务器状态 */}
        {stats && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">服务器状态</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">TPS</div>
                <div className="font-semibold">{stats.tps.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">CPU</div>
                <div className="font-semibold">{stats.cpu}%</div>
              </div>
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">内存</div>
                <div className="font-semibold">
                  {stats.memory.used.toFixed(1)} / {stats.memory.max} GB
                </div>
              </div>
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">玩家</div>
                <div className="font-semibold">
                  {stats.onlinePlayers} / {stats.maxPlayers}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 玩家列表 */}
        {players.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">玩家列表 ({players.length})</h3>
            <div className="space-y-1">
              {players.map(player => (
                <div key={player.id} className="flex items-center gap-2 text-sm p-1">
                  <span className="font-medium">{player.name}</span>
                  <span className="text-muted-foreground">Ping: {player.ping}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* WebSocket 演示 */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-3">WebSocket 测试</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            onClick={handleDisconnectServer}
            disabled={!currentServerId}
            className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            断开服务器
          </button>
          <button 
            onClick={handleSubscribeStats}
            disabled={!currentServerId}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            订阅状态更新
          </button>
          <button 
            onClick={() => handleSendCommand('list')}
            disabled={!currentServerId}
            className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            发送 list 命令
          </button>
          <button 
            onClick={() => handleSendCommand('help')}
            disabled={!currentServerId}
            className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            发送 help 命令
          </button>
        </div>

        {/* 控制台消息 */}
        {consoleMessages.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">
              控制台消息 (最近 {consoleMessages.length} 条)
            </h3>
            <div className="space-y-1 max-h-64 overflow-y-auto rounded border p-2 bg-muted/20">
              {consoleMessages.map(msg => (
                <div key={msg.id} className="text-xs font-mono">
                  <span className="text-muted-foreground">
                    [{new Date(msg.timestamp).toLocaleTimeString()}]
                  </span>{' '}
                  <Badge variant="outline" className="text-xs mr-1">
                    {msg.type}
                  </Badge>
                  <span>{msg.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
