/**
 * RAG检索增强生成链 - RAG Chain
 * 
 * 功能说明：
 * 1. 实现检索增强生成（Retrieval-Augmented Generation）核心流程
 * 2. 用户提问 -> 向量检索 -> 组装Prompt -> LLM生成回答
 * 3. 支持混合检索策略（相似度检索 + MMR多样性检索）
 * 4. 支持返回参考来源文档
 * 
 * RAG流程详解：
 * 1. 用户提出问题
 * 2. 将问题向量化，在ChromaDB中检索最相关的文档片段
 * 3. 将检索到的文档片段作为上下文，组装到Prompt模板中
 * 4. 将组装好的Prompt发送给大语言模型
 * 5. 模型基于上下文生成回答
 * 6. 返回回答和参考来源
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { BufferMemory, ChatMessageHistory } from 'langchain/memory';
import { Document } from '@langchain/core/documents';
import { similaritySearch, mmrSearch } from './vector-store';

/**
 * 将文档数组格式化为字符串
 * 
 * 功能：将LangChain Document数组转换为纯文本字符串
 * 每个文档的内容之间用分隔线隔开
 * 
 * @param docs - Document数组
 * @returns string 格式化后的文本
 */
export function formatDocumentsAsString(docs: Document[]): string {
  return docs
    .map((doc, i) => {
      // 添加文档来源信息（如果有元数据）
      const source = doc.metadata?.title ? `（来源：${doc.metadata.title}）` : '';
      return `[文档片段 ${i + 1}]${source}\n${doc.pageContent}`;
    })
    .join('\n\n---\n\n');
}

/**
 * RAG链配置接口
 * 定义了创建RAG链时可以自定义的参数
 */
export interface RAGChainConfig {
  /** 使用的模型名称，默认从环境变量读取 */
  modelName?: string;
  /** 温度参数（0-2），控制输出随机性，默认0.7 */
  temperature?: number;
  /** 最大生成Token数，默认2048 */
  maxTokens?: number;
  /** 检索返回的文档数量，默认3 */
  retrievalK?: number;
  /** 是否使用MMR检索（提高多样性），默认false */
  useMMR?: boolean;
  /** 是否返回参考来源，默认true */
  returnSourceDocuments?: boolean;
  /** 是否启用深度思考（thinking参数），默认true */
  enableThinking?: boolean;
}

/**
 * RAG响应接口
 * 定义了RAG链返回的数据结构
 */
export interface RAGResponse {
  /** AI生成的回答文本 */
  answer: string;
  /** 参考来源文档列表 */
  sourceDocuments: Document[];
  /** 检索到的文档数量 */
  retrievedCount: number;
}

/**
 * 创建大语言模型实例
 *
 * 功能：根据配置创建ChatOpenAI实例
 * 使用智谱AI的OpenAI兼容接口
 *
 * @param config - RAG链配置
 * @returns ChatOpenAI 实例
 */
export function createLLM(config?: RAGChainConfig): ChatOpenAI {
  return new ChatOpenAI({
    // 智谱AI的API密钥
    apiKey: process.env.OPENAI_API_KEY,
    // 模型配置
    modelName: config?.modelName || process.env.OPENAI_MODEL_NAME || 'glm-Z1-flash',
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens ?? 2048,
    // 智谱AI的API基础URL
    configuration: {
      baseURL: process.env.OPENAI_API_BASE || 'https://open.bigmodel.cn/api/paas/v4',
    },
    // 启用流式输出
    streaming: true,
  });
}

/**
 * RAG Prompt模板
 * 
 * 这是RAG系统的核心Prompt，定义了AI回答问题的格式和规则：
 * 1. 必须基于提供的上下文回答问题
 * 2. 如果上下文中没有相关信息，明确表示不知道
 * 3. 回答需要引用来源
 * 4. 使用中文回答
 */
export const RAG_PROMPT_TEMPLATE = `你是知识库问答助手。我会提供参考文档，你必须基于这些文档回答问题。

【重要】参考文档内容如下：
{context}

【重要】用户问题：
{question}

【回答要求】
1. 必须基于上述参考文档的内容回答
2. 如果文档中有相关信息，请详细总结并回答
3. 如果文档中没有相关信息，请明确说"根据现有文档，我无法回答这个问题"
4. 回答时引用具体的文档来源
5. 使用中文回答
6. 【重要】直接给出最终回答，不要输出思考过程，不要使用<think>标签

请基于参考文档回答用户问题：`;

/**
 * 执行RAG检索
 * 
 * 功能：根据用户问题检索相关文档片段
 * 支持两种检索策略：
 * 1. 相似度检索（默认）：返回与问题最相似的文档
 * 2. MMR检索：在保证相关性的同时提高结果多样性
 * 
 * @param query - 用户问题
 * @param config - RAG配置
 * @returns Promise<Document[]> 检索到的文档数组
 */
export async function retrieveDocuments(
  query: string,
  config?: RAGChainConfig
): Promise<Document[]> {
  const k = config?.retrievalK || 3;

  if (config?.useMMR) {
    // 使用MMR检索，提高结果多样性
    return mmrSearch(query, k);
  } else {
    // 使用相似度检索，返回最相关的文档
    return similaritySearch(query, k);
  }
}

/**
 * 执行RAG问答（非流式）
 * 
 * 功能：完整的RAG问答流程
 * 1. 检索相关文档
 * 2. 组装Prompt
 * 3. 调用LLM生成回答
 * 4. 返回回答和来源
 * 
 * @param question - 用户问题
 * @param config - RAG配置
 * @returns Promise<RAGResponse> RAG响应
 */
export async function askQuestion(
  question: string,
  config?: RAGChainConfig
): Promise<RAGResponse> {
  // 第一步：检索相关文档
  const docs = await retrieveDocuments(question, config);

  // 如果没有检索到相关文档
  if (docs.length === 0) {
    return {
      answer: '抱歉，我在知识库中没有找到与您问题相关的文档。请先上传相关文档，然后再提问。',
      sourceDocuments: [],
      retrievedCount: 0,
    };
  }

  // 第二步：将文档内容格式化为字符串
  const contextText = formatDocumentsAsString(docs);

  // 第三步：组装Prompt
  const prompt = RAG_PROMPT_TEMPLATE
    .replace('{context}', contextText)
    .replace('{question}', question);

  // 第四步：调用LLM生成回答
  const llm = createLLM(config);
  const response = await llm.invoke([{ role: 'user', content: prompt }]);

  // 第五步：返回结果
  return {
    answer: response.content as string,
    sourceDocuments: config?.returnSourceDocuments !== false ? docs : [],
    retrievedCount: docs.length,
  };
}

/**
 * 创建流式RAG链
 * 
 * 功能：创建支持流式输出的RAG链
 * 用于实现打字机效果，提升用户体验
 * 
 * @param config - RAG配置
 * @returns 返回一个异步生成器，逐token输出回答
 */
export async function* streamRAGAnswer(
  question: string,
  config?: RAGChainConfig
): AsyncGenerator<string, void, unknown> {
  // 第一步：检索相关文档
  const docs = await retrieveDocuments(question, config);

  // 如果没有检索到相关文档
  if (docs.length === 0) {
    yield '抱歉，我在知识库中没有找到与您问题相关的文档。请先上传相关文档，然后再提问。';
    return;
  }

  // 第二步：将文档内容格式化为字符串
  const contextText = formatDocumentsAsString(docs);

  // 第三步：组装Prompt
  const prompt = RAG_PROMPT_TEMPLATE
    .replace('{context}', contextText)
    .replace('{question}', question);

  // 第四步：创建LLM并流式调用
  const llm = createLLM(config);
  const stream = await llm.stream([{ role: 'user', content: prompt }]);

  // 第五步：逐token输出
  for await (const chunk of stream) {
    // 每个chunk包含一个token
    const token = chunk.content as string;
    if (token) {
      yield token;
    }
  }
}

/**
 * 对话记忆管理
 * 
 * 功能：管理多轮对话的上下文记忆
 * 使用BufferMemory存储对话历史
 */

// 存储不同会话的记忆实例
const sessionMemories = new Map<string, BufferMemory>();

/**
 * 获取或创建会话记忆
 * 
 * @param sessionId - 会话ID
 * @returns BufferMemory 记忆实例
 */
export function getSessionMemory(sessionId: string): BufferMemory {
  if (!sessionMemories.has(sessionId)) {
    // 创建新的记忆实例
    const memory = new BufferMemory({
      memoryKey: 'chat_history',         // 记忆键名
      returnMessages: true,              // 返回消息对象而非字符串
      chatHistory: new ChatMessageHistory(),  // 聊天历史
    });
    sessionMemories.set(sessionId, memory);
  }
  return sessionMemories.get(sessionId)!;
}

/**
 * 清除会话记忆
 * 
 * @param sessionId - 会话ID
 */
export function clearSessionMemory(sessionId: string): void {
  sessionMemories.delete(sessionId);
}
