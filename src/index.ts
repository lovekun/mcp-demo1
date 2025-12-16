import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// 启用 CORS
app.use(cors());
app.use(express.json());

// 简单访问日志
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// 处理所有 OPTIONS 预检请求
app.options('*', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// 根端点 - 提供服务器信息
app.get('/', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    name: 'mcp-demo1',
    version: '1.0.0',
    protocol: 'MCP',
    protocolVersion: '2024-11-05',
    endpoints: {
      mcp: '/mcp',
      health: '/health'
    }
  });
});

// 健康检查端点
app.get('/health', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ status: 'ok', message: 'hello world' });
});

// 定义工具列表
const tools = [
  {
    name: 'hello_world',
    description: '输出 Hello World 消息',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: '可选的自定义消息',
          default: 'Hello World'
        }
      }
    }
  },
  {
    name: 'greet',
    description: '发送问候消息',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '要问候的名字'
        }
      },
      required: ['name']
    }
  }
];

// 处理工具调用
const handleToolCall = async (req: { params: { name: string; arguments?: any } }) => {
  const { name, arguments: args } = req.params;
  
  if (name === 'hello_world') {
    return {
      content: [
        {
          type: 'text',
          text: args?.message || 'Hello World from MCP Demo!'
        }
      ]
    };
  } else if (name === 'greet') {
    return {
      content: [
        {
          type: 'text',
          text: `Hello, ${args?.name || 'Guest'}! Welcome to MCP Demo!`
        }
      ]
    };
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }
};

// GET /mcp - SSE 端点
app.get('/mcp', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const send = (event: string | null, data: any) => {
    try {
      if (event) {
        res.write(`event: ${event}\n`);
      }
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('[SSE] 发送消息失败:', error);
    }
  };

  send('ready', { ok: true });

  const interval = setInterval(() => {
    send('keepalive', { t: Date.now() });
  }, 25000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// POST /mcp - JSON-RPC 2.0 端点
app.post('/mcp', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { id, jsonrpc, method, params } = req.body || {};
  console.log('[MCP] incoming:', JSON.stringify(req.body));

  // 统一响应构造函数
  const ok = (result: any) => ({ jsonrpc: '2.0', id, result });
  const err = (code: number, message: string, data?: any) => ({ 
    jsonrpc: '2.0', 
    id, 
    error: { code, message, data } 
  });

  if (jsonrpc !== '2.0') {
    return res.status(400).json(err(-32600, 'Invalid Request: jsonrpc must be 2.0'));
  }

  try {
    // 1) 处理"通知"类请求：无 id → 不返回任何响应
    if (id === undefined || id === null) {
      // 例如 notifications/initialized 等
      if (method === 'notifications/initialized') {
        // 可做内部状态更新，但不要返回 JSON
        return res.status(204).end();
      }
      // 其他未知通知同样丢弃
      return res.status(204).end();
    }
    
    // 握手 / 初始化
    if (method === 'initialize') {
      const clientProtocol = params?.protocolVersion;
      return res.json(ok({
        protocolVersion: clientProtocol || '2024-11-05',
        serverInfo: {
          name: 'mcp-demo1',
          version: '1.0.0'
        },
        capabilities: {
          tools: { listChanged: false },
          prompts: {},
          resources: {},
          roots: { listChanged: false }
        }
      }));
    }

    if (method === 'initialized' || method === 'notifications/initialized') {
      return res.json(ok({ ok: true }));
    }

    // 会话（可选）
    if (method === 'sessions/create') {
      return res.json(ok({ sessionId: 'demo-session', expiresIn: 600 }));
    }
    if (method === 'sessions/keepalive') {
      return res.json(ok({ ok: true }));
    }
    if (method === 'sessions/close') {
      return res.json(ok({ ok: true }));
    }
    if (method === 'ping') {
      return res.json(ok({ pong: true }));
    }

    // 根/资源/提示（空实现以通过能力探测）
    if (method === 'roots/list') {
      return res.json(ok({ roots: [] }));
    }
    if (method === 'prompts/list') {
      return res.json(ok({ prompts: [] }));
    }
    if (method === 'resources/list') {
      return res.json(ok({ resources: [] }));
    }
    if (method === 'resources/read') {
      return res.json(ok({ contents: [] }));
    }

    // 工具列表
    if (method === 'tools/list') {
      return res.json(ok({ tools }));
    }

    // 工具调用
    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      if (!name) {
        return res.status(400).json(err(-32602, 'Invalid params: missing name'));
      }
      try {
        const result = await handleToolCall({ params: { name, arguments: args } });
        return res.json(ok(result));
      } catch (error: any) {
        return res.status(500).json(err(-32603, 'Internal error', { message: error.message }));
      }
    }

    // 未知方法
    return res.status(404).json(err(-32601, `Method not found: ${method}`));
  } catch (error: any) {
    console.error('[MCP] error:', error);
    return res.status(500).json(err(-32000, 'Server error', { message: error.message }));
  }
});

// 启动服务器 - 监听所有网络接口
const port = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
app.listen(port, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`MCP Demo Server is running`);
  console.log(`========================================`);
  console.log(`Server: http://0.0.0.0:${port}`);
  console.log(`Local:  http://localhost:${port}`);
  console.log(`MCP endpoint: http://0.0.0.0:${port}/mcp`);
  console.log(`Health check: http://0.0.0.0:${port}/health`);
  console.log(`========================================`);
});
