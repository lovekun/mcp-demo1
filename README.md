# MCP Demo 1 - Hello World

这是一个简单的 MCP (Model Context Protocol) 演示项目，使用 Node.js + TypeScript 实现，支持 SSE (Server-Sent Events) 调用。

## 功能

- ✅ SSE 端点 (`/sse`) - 支持实时流式通信
- ✅ POST 消息端点 (`/messages`) - 处理 MCP 请求
- ✅ 健康检查端点 (`/health`)
- ✅ 输出 "Hello World" 消息

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译 TypeScript

```bash
npm run build
```

### 3. 运行服务器

```bash
npm start
```

或者使用开发模式（自动重新编译）：

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

## 端点说明

### GET /sse
SSE 端点，用于实时流式通信。

**示例：**
```bash
curl http://localhost:3000/sse
```

### POST /messages
处理 MCP 协议请求。

**请求示例：**
```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "hello",
    "params": {},
    "id": 1
  }'
```

**响应示例：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "message": "Hello World",
    "greeting": "Welcome to MCP Demo!"
  }
}
```

### GET /health
健康检查端点。

**示例：**
```bash
curl http://localhost:3000/health
```

## 环境变量

- `PORT`: 服务器端口（默认: 3000）

## 项目结构

```
demo1/
├── src/
│   └── index.ts          # 主服务器文件
├── dist/                 # 编译输出目录
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

### 监听模式编译
```bash
npm run watch
```

### 使用 ts-node 直接运行（开发模式）
```bash
npm run dev
```

## Docker 支持

如果需要 Docker 运行，可以创建 `Dockerfile`：

```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 注意事项

- SSE 连接会保持打开状态，定期发送心跳消息
- 客户端断开连接时，服务器会自动清理资源
- 支持 CORS，可以从任何来源访问

