/**
 * AI Agent系统模块 - Agent
 * 
 * 功能说明：
 * 1. 实现ReAct（Reasoning + Acting）模式的AI Agent
 * 2. 支持工具调用（Tool Calling）
 * 3. 内置工具：获取时间、网络搜索、计算器
 * 4. 支持自定义工具扩展
 * 5. 显示AI思考过程
 * 
 * ReAct流程：
 * Thought（思考） -> Action（执行工具） -> Observation（观察结果） -> 循环
 * 
 * 工具调用系统：
 * - 定义可扩展的工具接口
 * - Agent根据用户问题自主决定是否调用工具
 * - 工具执行结果作为观察反馈给Agent
 */

import { ChatOpenAI } from '@langchain/openai';
import { DynamicTool } from '@langchain/core/tools';
import { createLLM } from './rag-chain';

/**
 * 工具定义接口
 * 定义了Agent可调用的工具结构
 */
export interface ToolDefinition {
  /** 工具唯一标识 */
  id: string;
  /** 工具名称（显示用） */
  name: string;
  /** 工具描述（告诉LLM何时使用此工具） */
  description: string;
  /** 工具是否启用 */
  enabled: boolean;
  /** 工具执行函数 */
  execute: (input: string) => Promise<string>;
}

/**
 * 创建"获取当前时间"工具
 * 
 * 功能：获取当前的日期和时间
 * 当用户询问时间相关问题时，Agent会自动调用此工具
 * 
 * @returns DynamicTool LangChain工具实例
 */
export function createTimeTool(): DynamicTool {
  return new DynamicTool({
    name: 'getCurrentTime',
    description: '获取当前的日期和时间。当用户询问"现在几点"、"今天日期"、"当前时间"等问题时使用此工具。',
    func: async () => {
      // 获取当前时间并格式化为中文
      const now = new Date();
      const formatted = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return `当前时间是：${formatted}`;
    },
  });
}

/**
 * 创建"计算器"工具
 * 
 * 功能：执行数学计算
 * 支持基本的四则运算和复杂数学表达式
 * 
 * @returns DynamicTool LangChain工具实例
 */
export function createCalculatorTool(): DynamicTool {
  return new DynamicTool({
    name: 'calculator',
    description: '执行数学计算。当用户需要进行数值计算时使用此工具。输入应为数学表达式，如"2+3*4"或"Math.sqrt(16)"。',
    func: async (input: string) => {
      try {
        // 安全地执行数学表达式
        // 使用Function构造器而非eval，限制可访问的全局对象
        const sanitizedInput = input.trim();
        
        // 基本安全检查：只允许数字、运算符和数学函数
        if (!/^[0-9+\-*/().%\sMath.sqrt.pow.sin.cos.tan.log.abs.ceil.floor.round.pi.e]+$/.test(sanitizedInput)) {
          return '错误：表达式包含不允许的字符。只支持数字和基本数学运算。';
        }

        // 创建安全的计算环境
        const mathScope = {
          Math: Math,
          pi: Math.PI,
          e: Math.E,
        };

        // 使用Function构造器执行计算
        const calcFn = new Function(...Object.keys(mathScope), `return ${sanitizedInput}`);
        const result = calcFn(...Object.values(mathScope));

        // 返回计算结果
        return `计算结果：${sanitizedInput} = ${result}`;
      } catch (error) {
        return `计算错误：无法计算表达式 "${input}"。请检查输入格式。`;
      }
    },
  });
}

/**
 * 创建"网络搜索"工具
 * 
 * 功能：搜索互联网获取最新信息
 * 当前为模拟实现，实际项目中应接入SerpAPI或其他搜索API
 * 
 * @returns DynamicTool LangChain工具实例
 */
export function createSearchTool(): DynamicTool {
  return new DynamicTool({
    name: 'searchWeb',
    description: '搜索互联网获取最新信息。当用户询问实时信息、新闻、天气等需要联网查询的问题时使用此工具。',
    func: async (query: string) => {
      // 模拟搜索结果
      // 实际项目中应接入SerpAPI或其他搜索API
      return `搜索 "${query}" 的结果：\n` +
        `1. [模拟结果] 关于"${query}"的最新信息...\n` +
        `2. [模拟结果] "${query}"相关详细说明...\n` +
        `注意：当前为模拟搜索结果，请接入真实搜索API获取准确信息。`;
    },
  });
}

/**
 * 创建"天气查询"工具
 * 
 * 功能：查询指定城市的天气信息
 * 当前为模拟实现，实际项目中应接入天气API
 * 
 * @returns DynamicTool LangChain工具实例
 */
export function createWeatherTool(): DynamicTool {
  return new DynamicTool({
    name: 'getWeather',
    description: '查询指定城市的天气信息。当用户询问天气情况时使用此工具。输入应为城市名称。',
    func: async (city: string) => {
      // 模拟天气查询结果
      const conditions = ['晴天', '多云', '小雨', '阴天', '大风'];
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      const temp = Math.floor(Math.random() * 30 + 5);
      
      return `${city}当前天气：${condition}，温度约${temp}°C。\n` +
        `注意：当前为模拟天气数据，请接入真实天气API获取准确信息。`;
    },
  });
}

/**
 * 根据配置获取启用的工具列表
 * 
 * 功能：根据工具开关配置，返回启用的工具实例列表
 * 
 * @param enabledToolIds - 启用的工具ID数组
 * @returns DynamicTool[] 工具实例数组
 */
export function getEnabledTools(enabledToolIds?: string[]): DynamicTool[] {
  // 所有可用工具的映射
  const allTools: Record<string, () => DynamicTool> = {
    time: createTimeTool,         // 获取时间
    calculator: createCalculatorTool,  // 计算器
    search: createSearchTool,     // 网络搜索
    weather: createWeatherTool,   // 天气查询
  };

  // 如果没有指定启用的工具，返回所有工具
  if (!enabledToolIds || enabledToolIds.length === 0) {
    return Object.values(allTools).map(createFn => createFn());
  }

  // 只返回启用的工具
  return enabledToolIds
    .filter(id => id in allTools)
    .map(id => allTools[id]());
}

/**
 * Agent执行结果接口
 */
export interface AgentResult {
  /** Agent的最终回答 */
  output: string;
  /** 思考过程（ReAct模式） */
  thinking?: string;
  /** 使用的工具列表 */
  toolsUsed?: string[];
}

/**
 * 执行Agent查询（简化版ReAct）
 * 
 * 功能：使用ReAct模式执行查询
 * 1. Agent思考如何回答用户问题
 * 2. 决定是否需要调用工具
 * 3. 执行工具并观察结果
 * 4. 基于观察结果生成最终回答
 * 
 * @param question - 用户问题
 * @param enabledToolIds - 启用的工具ID列表
 * @param modelConfig - 模型配置
 * @returns Promise<AgentResult> Agent执行结果
 */
export async function executeAgent(
  question: string,
  enabledToolIds?: string[],
  modelConfig?: { modelName?: string; temperature?: number }
): Promise<AgentResult> {
  // 获取启用的工具
  const tools = getEnabledTools(enabledToolIds);

  // 创建工具描述文本，告诉LLM可用的工具
  const toolDescriptions = tools
    .map(tool => `- ${tool.name}: ${tool.description}`)
    .join('\n');

  // 构建Agent Prompt
  const agentPrompt = `你是一个智能AI助手，可以使用工具来帮助回答问题。

可用工具：
${toolDescriptions}

【重要】直接给出最终回答，不要输出思考过程，不要使用<think>标签

用户问题：${question}`;

  // 创建LLM实例
  const llm = createLLM({
    ...modelConfig,
    temperature: modelConfig?.temperature ?? 0,
  });

  // 调用LLM
  const response = await llm.invoke([{ role: 'user', content: agentPrompt }]);
  const responseText = response.content as string;

  // 解析Agent响应，提取工具调用和最终回答
  let thinking = '';
  let finalAnswer = responseText;
  const toolsUsed: string[] = [];

  // 提取思考过程
  const thoughtMatch = responseText.match(/思考[：:]([\s\S]*?)(?=行动|回答|$)/);
  if (thoughtMatch) {
    thinking = thoughtMatch[1].trim();
  }

  // 检测并执行工具调用
  for (const tool of tools) {
    const toolPattern = new RegExp(`使用工具:\\s*${tool.name}\\((.*?)\\)`, 's');
    const match = responseText.match(toolPattern);
    if (match) {
      // 执行工具
      const toolInput = match[1].trim();
      const toolResult = await tool.invoke(toolInput);
      toolsUsed.push(tool.name);

      // 将工具结果添加到上下文，再次调用LLM
      const followUpPrompt = `${agentPrompt}\n\nAgent的思考过程：\n${responseText}\n\n工具 ${tool.name} 的执行结果：${toolResult}\n\n请基于以上所有信息，给出最终回答：`;
      const followUpResponse = await llm.invoke([{ role: 'user', content: followUpPrompt }]);
      finalAnswer = followUpResponse.content as string;
    }
  }

  // 提取最终回答（去除"回答："前缀）
  const answerMatch = finalAnswer.match(/回答[：:]([\s\S]*)/);
  if (answerMatch) {
    finalAnswer = answerMatch[1].trim();
  }

  return {
    output: finalAnswer,
    thinking: thinking || undefined,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
  };
}

/**
 * 执行Agent查询（支持RAG上下文）- 混合模式
 * 
 * 功能：结合RAG检索结果和工具调用的混合模式
 * 1. 将RAG检索到的文档作为Agent的知识背景
 * 2. Agent可以基于这些知识回答问题
 * 3. 同时Agent可以使用工具获取额外信息
 * 
 * @param question - 用户问题
 * @param enabledToolIds - 启用的工具ID列表
 * @param ragContext - RAG检索到的文档内容（作为Agent的知识）
 * @param modelConfig - 模型配置
 * @returns Promise<AgentResult> Agent执行结果
 */
export async function executeAgentWithContext(
  question: string,
  enabledToolIds?: string[],
  ragContext?: string,
  modelConfig?: { modelName?: string; temperature?: number }
): Promise<AgentResult> {
  // 获取启用的工具
  const tools = getEnabledTools(enabledToolIds);

  // 创建工具描述文本
  const toolDescriptions = tools
    .map(tool => `- ${tool.name}: ${tool.description}`)
    .join('\n');

  // 构建混合模式Prompt
  let agentPrompt = '';
  
  if (ragContext && ragContext.trim().length > 0) {
    // 有RAG上下文：作为知识背景 + 可用工具
    agentPrompt = `你是一个智能AI助手，拥有以下知识背景和可用工具。

【知识库内容】
以下是从知识库中检索到的相关信息，请基于这些信息回答问题：

${ragContext}

【可用工具】
如果需要获取额外信息，可以使用以下工具：
${toolDescriptions}

【重要】直接给出最终回答，不要输出思考过程，不要使用<think>标签

用户问题：${question}`;
  } else {
    // 无RAG上下文：纯Agent模式
    agentPrompt = `你是一个智能AI助手，可以使用工具来帮助回答问题。

可用工具：
${toolDescriptions}

【重要】直接给出最终回答，不要输出思考过程，不要使用<think>标签

请按以下格式思考和回答：

思考：分析用户的问题，决定是否需要使用工具
行动：如果需要使用工具，使用格式 "使用工具: [工具名称](输入)" 
观察：工具返回的结果
...（可以多次思考和行动）
回答：基于以上分析，给出最终回答

如果不需要使用工具，直接给出回答。

用户问题：${question}`;
  }

  // 创建LLM实例
  const llm = createLLM({
    ...modelConfig,
    temperature: modelConfig?.temperature ?? 0,
  });

  // 调用LLM
  const response = await llm.invoke([{ role: 'user', content: agentPrompt }]);
  const responseText = response.content as string;

  // 解析Agent响应
  let thinking = '';
  let finalAnswer = responseText;
  const toolsUsed: string[] = [];

  // 提取思考过程
  const thoughtMatch = responseText.match(/思考[：:]([\s\S]*?)(?=行动|回答|$)/);
  if (thoughtMatch) {
    thinking = thoughtMatch[1].trim();
  }

  // 检测并执行工具调用
  for (const tool of tools) {
    const toolPattern = new RegExp(`使用工具:\\s*${tool.name}\\((.*?)\\)`, 's');
    const match = responseText.match(toolPattern);
    if (match) {
      // 执行工具
      const toolInput = match[1].trim();
      const toolResult = await tool.invoke(toolInput);
      toolsUsed.push(tool.name);

      // 将工具结果添加到上下文，再次调用LLM
      const followUpPrompt = `${agentPrompt}\n\nAgent的思考过程：\n${responseText}\n\n工具 ${tool.name} 的执行结果：${toolResult}\n\n请基于以上所有信息，给出最终回答：`;
      const followUpResponse = await llm.invoke([{ role: 'user', content: followUpPrompt }]);
      finalAnswer = followUpResponse.content as string;
    }
  }

  // 提取最终回答
  const answerMatch = finalAnswer.match(/回答[：:]([\s\S]*)/);
  if (answerMatch) {
    finalAnswer = answerMatch[1].trim();
  }

  return {
    output: finalAnswer,
    thinking: thinking || undefined,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
  };
}
