import type { Player } from '@/types'

export type PlayerRow = Player & {
  status: 'online' | 'offline'
  lastSeen: string
}

const mockPlayers: PlayerRow[] = [
  {
    id: 'p1',
    name: 'Steve',
    uuid: '11111111-1111-1111-1111-111111111111',
    onlineTime: 8300,
    ping: 42,
    status: 'online',
    lastSeen: '在线',
    position: { x: 128, y: 64, z: -42, dimension: '主世界' },
  },
  {
    id: 'p2',
    name: 'Alex',
    uuid: '22222222-2222-2222-2222-222222222222',
    onlineTime: 4200,
    ping: 88,
    status: 'online',
    lastSeen: '在线',
    position: { x: -64, y: 70, z: 256, dimension: '主世界' },
  },
  {
    id: 'p3',
    name: 'Notch',
    uuid: '33333333-3333-3333-3333-333333333333',
    onlineTime: 12000,
    ping: 120,
    status: 'online',
    lastSeen: '在线',
    position: { x: 12, y: 64, z: 98, dimension: '下界' },
  },
  {
    id: 'p4',
    name: 'Herobrine',
    uuid: '44444444-4444-4444-4444-444444444444',
    onlineTime: 0,
    ping: 0,
    status: 'offline',
    lastSeen: '2 小时前',
  },
  {
    id: 'p5',
    name: 'BuilderGuy',
    uuid: '55555555-5555-5555-5555-555555555555',
    onlineTime: 6900,
    ping: 60,
    status: 'online',
    lastSeen: '在线',
    position: { x: -256, y: 72, z: 44, dimension: '主世界' },
  },
  {
    id: 'p6',
    name: 'MinerJane',
    uuid: '66666666-6666-6666-6666-666666666666',
    onlineTime: 5100,
    ping: 160,
    status: 'online',
    lastSeen: '在线',
    position: { x: 33, y: 12, z: -74, dimension: '矿洞' },
  },
  {
    id: 'p7',
    name: 'RedstonePro',
    uuid: '77777777-7777-7777-7777-777777777777',
    onlineTime: 300,
    ping: 25,
    status: 'online',
    lastSeen: '在线',
    position: { x: 400, y: 64, z: 128, dimension: '主世界' },
  },
  {
    id: 'p8',
    name: 'Traveler',
    uuid: '88888888-8888-8888-8888-888888888888',
    onlineTime: 0,
    ping: 0,
    status: 'offline',
    lastSeen: '昨天 23:50',
  },
  {
    id: 'p9',
    name: 'SkyLord',
    uuid: '99999999-9999-9999-9999-999999999999',
    onlineTime: 2400,
    ping: 95,
    status: 'online',
    lastSeen: '在线',
    position: { x: 16, y: 120, z: -140, dimension: '末地' },
  },
  {
    id: 'p10',
    name: 'FarmerTom',
    uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    onlineTime: 0,
    ping: 0,
    status: 'offline',
    lastSeen: '3 天前',
  },
]

export const getMockPlayers = (): PlayerRow[] => mockPlayers.map((player) => ({ ...player }))
