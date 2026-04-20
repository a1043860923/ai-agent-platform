# AI Agent Platform - 智能知识库问答平台

一个基于 Next.js + LangChain 构建的 AI 智能问答平台，支持 RAG（检索增强生成）和 Agent（智能体）两种模式，让你的文档"活"起来。

![技术栈](https://img.shields.io/badge/Next.js-16.2.3-black?style=flat-square&logo=next.js)
![技术栈](https://img.shields.io/badge/React-19.2.4-61DAFB?style=flat-square&logo=react)
![技术栈](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![技术栈](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css)
![技术栈](https://img.shields.io/badge/LangChain-0.3-32CD32?style=flat-square)

---

## 🚀 项目核心功能

### 1. RAG 检索增强生成
基于用户上传的文档进行智能问答，让 AI 回答有迹可循。

**核心流程：**
```
文档上传 → 文本解析 → 智能分块 → 向量化 → 向量存储 → 相似度检索 → 上下文组装 → LLM生成回答
```

**技术亮点：**
- 📄 支持 PDF、Markdown 格式文档
- ✂️ 智能文本分割（RecursiveCharacterTextSplitter）
- 🔢 本地 Embedding 模型（Xenova/bge-small-zh-v1.5），无需 API 密钥
- 💾 本地向量存储（基于 JSON 文件），无需 Docker
- 🔍 支持相似度检索和 MMR 多样性检索
- 📚 自动引用参考来源

### 2. Agent 智能体模式
支持工具调用的 AI Agent，实现 ReAct（推理+行动）模式。

**内置工具：**
| 工具 | 功能 | 触发场景 |
|------|------|---------|
| 🕐 获取时间 | 获取当前日期时间 | 用户询问时间相关问题 |
| 🧮 计算器 | 执行数学计算 | 数值计算需求 |
| 🔍 网络搜索 | 搜索互联网信息 | 需要实时信息时 |
| 🌤️ 天气查询 | 查询城市天气 | 天气相关询问 |

**ReAct 流程：**
```
Thought（思考）→ Action（调用工具）→ Observation（观察结果）→ ... → Final Answer
```

### 3. 混合模式（RAG + Agent）
同时启用文档检索和工具调用，实现更强大的问答能力：
- 基于知识库回答专业问题
- 调用工具获取实时信息
- 综合多源信息生成回答

### 4. 流式输出与打字机效果
- 支持 SSE（Server-Sent Events）流式响应
- 实时显示 AI 思考过程
- 逐字输出的打字机效果

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (Next.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Document    │  │   Chat       │  │   Config     │          │
│  │  Panel       │  │   Window     │  │   Panel      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API 路由层 (App Router)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ /api/chat    │  │ /api/documents│  │ /api/upload  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      核心逻辑层 (Core)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  RAG Chain   │  │    Agent     │  │   Vector     │          │
│  │              │  │   System     │  │   Store      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Document   │  │   Local      │  │   Utils      │          │
│  │   Processor  │  │  Embeddings  │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      外部服务层                                  │
│  ┌──────────────┐  ┌──────────────────────────────────────┐    │
│  │  智谱 AI     │  │   Xenova Transformers (本地模型)      │    │
│  │  (GLM API)   │  │   - bge-small-zh-v1.5 (Embedding)    │    │
│  └──────────────┘  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
ai-agent-platform/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API 路由
│   │   │   ├── chat/route.ts     # 聊天接口（核心）
│   │   │   ├── documents/        # 文档管理接口
│   │   │   └── upload/route.ts   # 文件上传接口
│   │   ├── page.tsx              # 主页面
│   │   └── layout.tsx            # 根布局
│   ├── components/               # React 组件
│   │   ├── ui/                   # shadcn/ui 组件
│   │   ├── chat-window.tsx       # 聊天窗口
│   │   ├── document-panel.tsx    # 文档面板
│   │   ├── config-panel.tsx      # 配置面板
│   │   └── header.tsx            # 顶部导航
│   ├── lib/                      # 核心逻辑
│   │   ├── rag-chain.ts          # RAG 检索链
│   │   ├── agent.ts              # Agent 系统
│   │   ├── vector-store.ts       # 向量存储
│   │   ├── local-embeddings.ts   # 本地 Embedding
│   │   ├── document-processor.ts # 文档处理
│   │   └── utils.ts              # 工具函数
│   └── store/                    # 状态管理
│       └── app-store.ts          # Zustand 全局状态
├── chroma-data/                  # 向量数据存储
├── .cache/transformers/          # 本地模型缓存
├── public/                       # 静态资源
└── package.json
```

---

## 🛠️ 技术栈详解

### 前端技术栈
| 技术 | 用途 |
|------|------|
| **Next.js 16** | React 全栈框架，App Router 模式 |
| **React 19** | UI 组件库 |
| **TypeScript** | 类型安全 |
| **Tailwind CSS 4** | 原子化 CSS 框架 |
| **shadcn/ui** | 高质量 UI 组件 |
| **Framer Motion** | 动画效果 |
| **Zustand** | 轻量级状态管理 |
| **Lucide React** | 图标库 |

### AI/ML 技术栈
| 技术 | 用途 |
|------|------|
| **LangChain** | LLM 应用开发框架 |
| **@langchain/openai** | OpenAI 兼容 API 适配器 |
| **Vercel AI SDK** | AI 流式响应处理 |
| **Xenova Transformers** | 本地运行 Embedding 模型 |
| **bge-small-zh-v1.5** | 中文优化 Embedding 模型 |

### 文档处理
| 技术 | 用途 |
|------|------|
| **pdf-parse** | PDF 文件解析 |
| **RecursiveCharacterTextSplitter** | 智能文本分割 |

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
cd ai-agent-platform
npm install
```

### 配置环境变量

创建 `.env.local` 文件：

```env
# 智谱 AI API 配置（必需）
OPENAI_API_KEY=your_zhipu_api_key
OPENAI_API_BASE=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL_NAME=glm-Z1-flash

# 可选：Hugging Face 镜像（国内加速）
HF_MIRROR=https://hf-mirror.com

# 可选：向量存储目录
CHROMA_PERSIST_DIR=./chroma-data
```

> 获取智谱 AI API Key：[https://open.bigmodel.cn/](https://open.bigmodel.cn/)

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
npm run build
npm start
```

---

## 📖 使用指南

### 1. 上传文档
1. 点击左侧面板的"上传文档"按钮
2. 选择 PDF 或 Markdown 文件
3. 等待文档处理完成（自动分块、向量化）

### 2. 开始问答
1. 在底部输入框输入问题
2. 按 Enter 或点击发送按钮
3. AI 会基于上传的文档回答问题
4. 点击消息下方的"参考来源"查看引用文档

### 3. 配置参数
点击右上角设置图标打开配置面板：
- **模型选择**: 切换不同 GLM 模型
- **温度参数**: 控制回答随机性（0-2）
- **RAG 开关**: 启用/禁用文档检索
- **工具开关**: 启用/禁用 Agent 工具
- **深度思考**: 显示 AI 思考过程

### 4. 使用 Agent 工具
在配置面板启用"工具调用"，AI 将自动判断是否需要：
- 获取当前时间
- 执行数学计算
- 搜索网络信息
- 查询天气

---

## 🔧 核心模块详解

### RAG Chain (`src/lib/rag-chain.ts`)
实现检索增强生成的核心逻辑：
- `retrieveDocuments()`: 向量相似度检索
- `askQuestion()`: 完整 RAG 问答流程
- `streamRAGAnswer()`: 流式 RAG 响应
- `RAG_PROMPT_TEMPLATE`: RAG Prompt 模板

### Agent System (`src/lib/agent.ts`)
实现 ReAct 模式的 AI Agent：
- `executeAgentWithContext()`: 执行 Agent 循环
- `createTimeTool()`: 时间工具
- `createCalculatorTool()`: 计算器工具
- `createSearchTool()`: 搜索工具
- `createWeatherTool()`: 天气工具

### Vector Store (`src/lib/vector-store.ts`)
本地向量存储实现：
- `LocalVectorStore`: 基于 JSON 文件的向量存储
- `similaritySearch()`: 余弦相似度检索
- `mmrSearch()`: 最大边际相关性检索
- 自动持久化到本地文件

### Local Embeddings (`src/lib/local-embeddings.ts`)
本地 Embedding 模型：
- 使用 Xenova Transformers 运行 ONNX 模型
- 支持 bge-small-zh-v1.5（中文优化）
- 完全免费，无需 API 密钥
- 数据隐私，不上传云端

---

## 🎯 配置说明

### 聊天配置 (`ChatConfig`)

```typescript
{
  model: 'glm-Z1-flash',      // 模型名称
  temperature: 0.2,            // 随机性（0-2）
  maxTokens: 2048,             // 最大生成 Token
  topP: 0.3,                   // 多样性采样
  enableStreaming: true,       // 流式输出
  enableRAG: true,             // 启用 RAG
  enableTools: false,          // 启用工具
  enableThinking: true,        // 显示思考过程
}
```

### 推荐配置

| 场景 | temperature | topP | enableRAG | enableTools |
|------|-------------|------|-----------|-------------|
| 文档问答 | 0.2 | 0.3 | ✅ | ❌ |
| 创意写作 | 0.8 | 0.9 | ❌ | ❌ |
| 工具助手 | 0.5 | 0.5 | ❌ | ✅ |
| 混合模式 | 0.3 | 0.4 | ✅ | ✅ |

---

## 📝 开发计划

- [ ] 支持更多文档格式（Word、Excel、PPT）
- [ ] 接入真实搜索 API（SerpAPI、Bing Search）
- [ ] 接入真实天气 API
- [ ] 多会话历史管理
- [ ] 导出对话记录
- [ ] 支持图片输入（多模态）
- [ ] 支持语音输入/输出

---

## 🤝 贡献指南

欢迎提交 Issue 和 PR！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 全栈框架
- [LangChain](https://langchain.com/) - LLM 应用框架
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Xenova Transformers](https://github.com/xenova/transformers.js) - 本地 ML 模型
- [智谱 AI](https://open.bigmodel.cn/) - 大语言模型 API

---

**让 AI 更懂你的知识库！** 📚🤖
