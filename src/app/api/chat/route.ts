/**
 * 聊天API路由 - /api/chat
 * 
 * 功能说明：
 * 1. 接收用户消息，返回AI回答
 * 2. 支持流式响应（SSE - Server-Sent Events）
 * 3. 支持RAG检索增强生成（基于文档）
 * 4. 支持Agent工具调用（联网搜索、计算器等）
 * 5. 支持混合模式：RAG + Agent（文档+工具）
 * 6. 支持对话记忆管理
 * 
 * 请求格式：
 * POST /api/chat
 * Body: {
 *   messages: Array<{ role: 'user'|'assistant', content: string }>,
 *   config?: { model, temperature, maxTokens, enableRAG, enableTools, tools },
 *   sessionId?: string
 * }
 * 
 * 响应格式：
 * - 流式模式：SSE事件流，每个事件包含一个token
 * - 非流式模式：JSON响应，包含完整回答
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrieveDocuments, formatDocumentsAsString, createLLM, RAG_PROMPT_TEMPLATE } from '@/lib/rag-chain';
import { executeAgentWithContext, getEnabledTools } from '@/lib/agent';

/**
 * 聊天请求体接口
 */
interface ChatRequest {
  /** 消息历史 */
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  /** 配置选项 */
  config?: {
    /** 模型名称 */
    model?: string;
    /** 温度参数 */
    temperature?: number;
    /** 最大Token数 */
    maxTokens?: number;
    /** 是否启用RAG检索 */
    enableRAG?: boolean;
    /** 是否启用工具调用 */
    enableTools?: boolean;
    /** 启用的工具ID列表 */
    tools?: string[];
    /** 是否启用流式输出 */
    enableStreaming?: boolean;
    /** 是否启用深度思考（显示思考过程） */
    enableThinking?: boolean;
  };
  /** 会话ID（用于对话记忆） */
  sessionId?: string;
}

/**
 * POST 处理函数 - 处理聊天请求
 * 
 * @param req - Next.js请求对象
 * @returns NextResponse 响应对象
 */
export async function POST(req: NextRequest) {
  try {
    // ==================== 解析请求 ====================
    const body: ChatRequest = await req.json();
    const { messages, config = {}, sessionId } = body;

    // 获取最后一条用户消息
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: '没有找到用户消息' },
        { status: 400 }
      );
    }

    const question = lastUserMessage.content;

    // ==================== 判断是否启用流式输出 ====================
    const enableStreaming = config.enableStreaming !== false; // 默认启用

    // ==================== 执行RAG检索（如果启用） ====================
    let contextDocuments: any[] = [];
    let contextText = '';

    if (config.enableRAG !== false) {
      // 默认启用RAG
      try {
        // 检索相关文档
        contextDocuments = await retrieveDocuments(question, {
          modelName: config.model,
          retrievalK: 3,
        });
        // 格式化文档为文本
        contextText = formatDocumentsAsString(contextDocuments);
        console.log('RAG检索完成，找到', contextDocuments.length, '个相关文档');
        console.log('上下文内容长度:', contextText.length);
        if (contextText.length > 0) {
          console.log('上下文内容前300字:', contextText.substring(0, 300));
        }
      } catch (error) {
        // RAG检索失败时继续，但不使用上下文
        console.error('RAG检索失败，将不使用上下文:', error);
      }
    }

    // ==================== 判断是否使用工具 ====================
    const hasDocuments = contextDocuments.length > 0;
    const hasTools = config.enableTools && config.tools && config.tools.length > 0;

    // 如果需要流式输出，使用SSE
    if (enableStreaming) {
      const encoder = new TextEncoder();
      
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // 发送来源信息
            const sourcesData = JSON.stringify({ 
              type: 'sources', 
              sources: contextDocuments.map(doc => ({
                documentTitle: doc.metadata?.title || '未知文档',
                content: doc.pageContent.substring(0, 200),
                similarity: 0.9,
              }))
            });
            controller.enqueue(encoder.encode(`data: ${sourcesData}\n\n`));

            // 如果需要工具，先执行工具
            let finalPrompt = '';
            let toolsUsed: string[] = [];
            
            if (hasTools) {
              // 发送状态：正在使用工具
              const statusData = JSON.stringify({ 
                type: 'status', 
                message: '正在分析并调用工具...'
              });
              controller.enqueue(encoder.encode(`data: ${statusData}\n\n`));
              
              // 执行Agent获取工具结果
              const agentResult = await executeAgentWithContext(
                question,
                config.tools,
                contextText,
                {
                  modelName: config.model,
                  temperature: config.temperature,
                }
              );
              
              toolsUsed = agentResult.toolsUsed || [];
              
              // 构建最终Prompt：文档上下文 + 工具结果
              finalPrompt = `基于以下信息回答问题：

【知识库内容】
${contextText}

【工具查询结果】
${agentResult.output}

【用户问题】
${question}

请基于以上信息给出完整回答：`;
              
              // 发送状态：工具执行完成，开始生成
              const generatingData = JSON.stringify({ 
                type: 'status', 
                message: toolsUsed.length > 0 ? `工具执行完成，正在生成回答...` : '正在生成回答...'
              });
              controller.enqueue(encoder.encode(`data: ${generatingData}\n\n`));
            } else {
              // 无工具：使用普通RAG Prompt
              if (!hasDocuments) {
                // 没有文档也没有工具
                const noDocData = JSON.stringify({ 
                  type: 'content', 
                  token: '抱歉，我在知识库中没有找到与您问题相关的文档。请先上传相关文档，然后再提问。'
                });
                controller.enqueue(encoder.encode(`data: ${noDocData}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                controller.close();
                return;
              }
              
              finalPrompt = RAG_PROMPT_TEMPLATE
                .replace('{context}', contextText)
                .replace('{question}', question);
            }

            // 创建LLM实例并流式生成
            // 传递enableThinking参数，控制是否启用深度思考
            const llm = createLLM({
              modelName: config.model,
              temperature: config.temperature,
              maxTokens: config.maxTokens,
              enableThinking: config.enableThinking,
            });

            // 流式调用
            const stream = await llm.stream([{ role: 'user', content: finalPrompt }]);

            // 用于收集思考过程和内容
            let thinkingContent = '';
            let answerContent = '';
            let inThinkingMode = false;
            let buffer = '';  // 用于缓冲可能跨多个token的标签
            const enableThinking = config.enableThinking !== false; // 默认启用

            // 逐token输出
            for await (const chunk of stream) {
              const token = chunk.content as string;
              if (!token) continue;

              // 将token加入缓冲区
              buffer += token;

              // 处理 <think> 标签开始
              if (!inThinkingMode) {
                const thinkIndex = buffer.indexOf('<think>');
                if (thinkIndex !== -1) {
                  inThinkingMode = true;
                  // 发送 <think> 之前的内容（保留原始格式，不做trim）
                  const beforeThink = buffer.substring(0, thinkIndex);
                  if (beforeThink) {
                    answerContent += beforeThink;
                    const data = JSON.stringify({ token: beforeThink, type: 'content' });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  }
                  // 提取 <think> 之后的内容
                  const afterThink = buffer.substring(thinkIndex + 7); // 7 = '<think>'.length
                  thinkingContent += afterThink;
                  if (enableThinking && afterThink) {
                    const data = JSON.stringify({ token: afterThink, type: 'thinking' });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  }
                  buffer = ''; // 清空缓冲区
                  continue;
                }
              }

              // 处理 </think> 标签结束
              if (inThinkingMode) {
                const endThinkIndex = buffer.indexOf('</think>');
                if (endThinkIndex !== -1) {
                  inThinkingMode = false;
                  // 提取 </think> 之前的内容
                  const beforeEndThink = buffer.substring(0, endThinkIndex);
                  if (beforeEndThink) {
                    thinkingContent += beforeEndThink;
                    if (enableThinking) {
                      const data = JSON.stringify({ token: beforeEndThink, type: 'thinking' });
                      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                  }
                  // 提取 </think> 之后的内容作为正式回答
                  let afterEndThink = buffer.substring(endThinkIndex + 8); // 8 = '</think>'.length
                  // 去除开头的换行符，避免回答开头出现空行
                  afterEndThink = afterEndThink.replace(/^\n+/, '');
                  if (afterEndThink) {
                    answerContent += afterEndThink;
                    const data = JSON.stringify({ token: afterEndThink, type: 'content' });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  }
                  buffer = ''; // 清空缓冲区
                  continue;
                }
              }

              // 检查缓冲区是否包含不完整的标签，如果是则继续等待
              // 检查最后几个字符是否可能是标签的开始
              const lastLtIndex = buffer.lastIndexOf('<');
              if (lastLtIndex !== -1 && lastLtIndex > buffer.length - 10) {
                // 检查从 < 到末尾是否包含 >
                const afterLt = buffer.substring(lastLtIndex);
                if (!afterLt.includes('>')) {
                  // 可能是不完整的标签开头，继续等待
                  continue;
                }
              }

              // 处理缓冲区中的完整内容
              const contentToSend = buffer;
              if (inThinkingMode) {
                // 在思考过程中
                thinkingContent += contentToSend;
                if (enableThinking) {
                  const data = JSON.stringify({ token: contentToSend, type: 'thinking' });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              } else {
                // 正式回答内容
                answerContent += contentToSend;
                const data = JSON.stringify({ token: contentToSend, type: 'content' });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
              buffer = ''; // 清空缓冲区
            }

            // 处理最后可能剩余的缓冲区内容
            if (buffer) {
              if (inThinkingMode) {
                thinkingContent += buffer;
                if (enableThinking) {
                  const data = JSON.stringify({ token: buffer, type: 'thinking' });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              } else {
                answerContent += buffer;
                const data = JSON.stringify({ token: buffer, type: 'content' });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }

            // 发送思考过程总结（如果启用了深度思考）
            if (thinkingContent && enableThinking) {
              const thinkingData = JSON.stringify({
                type: 'thinking_complete',
                thinking: thinkingContent
              });
              controller.enqueue(encoder.encode(`data: ${thinkingData}\n\n`));
            }
            
            // 发送工具使用信息
            if (toolsUsed.length > 0) {
              const toolsData = JSON.stringify({ 
                type: 'tools', 
                toolsUsed 
              });
              controller.enqueue(encoder.encode(`data: ${toolsData}\n\n`));
            }
            
            // 发送结束标记
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (error) {
            console.error('流式生成出错:', error);
            const errorData = JSON.stringify({ type: 'error', message: '生成回答时出错' });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        },
      });

      // 返回SSE响应
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ==================== 非流式响应模式 ====================
    
    // 如果需要工具
    if (hasTools) {
      try {
        const agentResult = await executeAgentWithContext(
          question,
          config.tools,
          contextText,
          {
            modelName: config.model,
            temperature: config.temperature,
          }
        );

        return NextResponse.json({
          answer: agentResult.output,
          thinking: agentResult.thinking,
          toolsUsed: agentResult.toolsUsed,
          sources: contextDocuments.map(doc => ({
            documentTitle: doc.metadata?.title || '未知文档',
            content: doc.pageContent.substring(0, 200),
            similarity: 0.9,
          })),
        });
      } catch (error) {
        console.error('Agent执行失败:', error);
      }
    }

    // 普通RAG模式
    if (!hasDocuments) {
      return NextResponse.json({
        answer: '抱歉，我在知识库中没有找到与您问题相关的文档。请先上传相关文档，然后再提问。',
        sources: [],
        retrievedCount: 0,
      });
    }

    // 组装Prompt
    const prompt = RAG_PROMPT_TEMPLATE
      .replace('{context}', contextText)
      .replace('{question}', question);

    try {
      // 创建LLM实例，传递enableThinking参数
      const llm = createLLM({
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        enableThinking: config.enableThinking,
      });

      const response = await llm.invoke([{ role: 'user', content: prompt }]);

      return NextResponse.json({
        answer: response.content as string,
        sources: contextDocuments.map(doc => ({
          documentTitle: doc.metadata?.title || '未知文档',
          content: doc.pageContent.substring(0, 200),
          similarity: 0.9,
        })),
        retrievedCount: contextDocuments.length,
      });
    } catch (error) {
      console.error('生成回答失败:', error);
      return NextResponse.json(
        { error: '生成回答失败，请稍后重试' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('聊天API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
