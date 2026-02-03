# Minecraft Server Manager WebUI

基于 React + Vite + shadcn/ui 构建的 Minecraft Java 服务器远程管理 Web 界面。

## 功能特性

- 🎮 **实时控制台** - 通过 Web 界面远程管理 Minecraft 服务器
- 📊 **服务器监控** - 实时监控 TPS、CPU、内存等关键指标
- 👥 **玩家管理** - 查看在线玩家、执行管理操作
- 🔌 **RCON 支持** - 通过 RCON 协议与服务器通信
- 🎨 **现代化 UI** - 基于 shadcn/ui 的简洁美观界面
- 🌙 **暗色模式** - 支持亮色/暗色主题切换

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **UI 组件库**: shadcn/ui + Tailwind CSS
- **状态管理**: React Context / Zustand
- **实时通信**: WebSocket / Socket.io
- **图表展示**: Recharts

## 快速开始

### 前端开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 后端开发

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 完整启动指南

详细的启动和配置说明请查看 [快速启动指南](QUICKSTART.md)

### 前后端集成

前后端集成已完成，包括：
- ✅ REST API 客户端服务
- ✅ WebSocket 实时通信
- ✅ 完整的集成文档和示例

相关文档：
- [前端集成指南](FRONTEND_INTEGRATION_GUIDE.md)
- [集成总结](FRONTEND_INTEGRATION_SUMMARY.md)
- [后端对接文档](backend/backend-integration.md)

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
