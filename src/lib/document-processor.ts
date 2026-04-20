/**
 * 文档处理模块 - DocumentProcessor
 * 
 * 功能说明：
 * 1. 支持PDF和Markdown格式文档的解析
 * 2. 使用RecursiveCharacterTextSplitter进行文本分割
 * 3. 将分割后的文本向量化并存储到ChromaDB
 * 4. 管理文档的元数据信息
 * 
 * 处理流程：
 * 文件上传 -> 解析文档 -> 文本分割 -> 向量化 -> 存储到ChromaDB
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { createVectorStoreFromDocs, getVectorStore } from './vector-store';

/**
 * 文档处理结果接口
 * 定义了文档处理完成后返回的数据结构
 */
export interface DocumentProcessResult {
  /** 处理是否成功 */
  success: boolean;
  /** 文档ID（用于后续管理和删除） */
  documentId: string;
  /** 文档标题（通常是文件名） */
  title: string;
  /** 分割后的文本块数量 */
  chunkCount: number;
  /** 错误信息（如果处理失败） */
  error?: string;
}

/**
 * 文档元数据接口
 * 存储在向量数据库中的元数据，用于后续检索和展示
 */
export interface DocumentMetadata {
  /** 文档唯一标识 */
  documentId: string;
  /** 文档标题/文件名 */
  title: string;
  /** 文档类型：pdf 或 markdown */
  type: 'pdf' | 'markdown';
  /** 文件大小（字节） */
  size: number;
  /** 上传时间 */
  uploadTime: string;
  /** 文本块索引（第几个块） */
  chunkIndex: number;
  /** 文本块总数 */
  totalChunks: number;
}

/**
 * 解析PDF文件
 * 
 * 功能：将PDF文件的Buffer解析为纯文本
 * 使用pdf-parse库提取PDF中的文字内容
 * 
 * @param buffer - PDF文件的Buffer数据
 * @returns Promise<string> 解析出的纯文本内容
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // 动态导入pdf-parse，避免在服务端渲染时出现问题
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    
    // 解析PDF文件
    const data = await pdfParse(buffer);
    
    // 返回提取的文本内容
    return data.text;
  } catch (error) {
    console.error('PDF解析失败:', error);
    throw new Error(`PDF解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 解析Markdown文件
 * 
 * 功能：将Markdown文件的Buffer转换为文本
 * Markdown本身是纯文本格式，直接解码即可
 * 
 * @param buffer - Markdown文件的Buffer数据
 * @returns Promise<string> 文本内容
 */
export async function parseMarkdown(buffer: Buffer): Promise<string> {
  try {
    // 将Buffer解码为UTF-8字符串
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Markdown解析失败:', error);
    throw new Error(`Markdown解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 分割文本
 * 
 * 功能：使用RecursiveCharacterTextSplitter将长文本分割为小块
 * 递归分割策略：优先在段落边界分割，其次在句子边界，最后在字符边界
 * 
 * 配置参数（根据开发文档）：
 * - chunk_size: 1000（每个文本块最大1000个字符）
 * - chunk_overlap: 200（相邻块重叠200个字符，保证上下文连贯）
 * 
 * @param text - 要分割的文本
 * @param chunkSize - 每个块的最大字符数，默认1000
 * @param chunkOverlap - 相邻块的重叠字符数，默认200
 * @returns Promise<Document[]> 分割后的LangChain Document数组
 */
export async function splitText(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<Document[]> {
  // 创建文本分割器实例
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize,        // 每个块的最大长度
    chunkOverlap,     // 块之间的重叠长度
    // 分割器会按优先级尝试以下分隔符：
    separators: [
      '\n\n',     // 优先在段落边界分割
      '\n',       // 其次在换行处分割
      '。',       // 中文句号
      '！',       // 中文感叹号
      '？',       // 中文问号
      '.',        // 英文句号
      '!',        // 英文感叹号
      '?',        // 英文问号
      ' ',        // 空格
      '',         // 最后按字符分割
    ],
  });

  // 执行文本分割，返回Document数组
  const docs = await textSplitter.createDocuments([text]);
  return docs;
}

/**
 * 处理文档（核心处理流程）
 * 
 * 功能：完整的文档处理流程
 * 1. 根据文件类型解析文档内容
 * 2. 使用文本分割器将内容分块
 * 3. 为每个文本块添加元数据
 * 4. 将文本块向量化并存储到ChromaDB
 * 
 * @param buffer - 文件的Buffer数据
 * @param filename - 文件名
 * @param mimeType - 文件MIME类型
 * @param fileSize - 文件大小（字节）
 * @returns Promise<DocumentProcessResult> 处理结果
 */
export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  fileSize: number
): Promise<DocumentProcessResult> {
  // 生成唯一的文档ID
  const documentId = crypto.randomUUID();

  try {
    // ==================== 第一步：解析文档 ====================
    let text: string;
    // 判断文件类型
    const isPdf = mimeType === 'application/pdf' || filename.endsWith('.pdf');
    const isMarkdown = filename.endsWith('.md') || filename.endsWith('.markdown');

    if (isPdf) {
      // 解析PDF文件
      text = await parsePDF(buffer);
    } else if (isMarkdown) {
      // 解析Markdown文件
      text = await parseMarkdown(buffer);
    } else {
      // 不支持的文件类型
      return {
        success: false,
        documentId,
        title: filename,
        chunkCount: 0,
        error: `不支持的文件类型: ${mimeType}`,
      };
    }

    // 检查解析结果是否为空
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        documentId,
        title: filename,
        chunkCount: 0,
        error: '文档内容为空',
      };
    }

    // ==================== 第二步：文本分割 ====================
    const chunks = await splitText(text);

    // ==================== 第三步：添加元数据 ====================
    // 为每个文本块添加文档元数据，方便后续检索和管理
    const docType = isPdf ? 'pdf' : 'markdown';
    const docsWithMetadata = chunks.map((chunk, index) => {
      // 创建新的Document，保留原始内容并添加元数据
      return new Document({
        pageContent: chunk.pageContent,
        metadata: {
          documentId,                              // 文档ID
          title: filename,                         // 文件名
          type: docType,                           // 文件类型
          size: fileSize,                          // 文件大小
          uploadTime: new Date().toISOString(),    // 上传时间
          chunkIndex: index,                       // 当前块索引
          totalChunks: chunks.length,              // 总块数
        } satisfies DocumentMetadata,
      });
    });

    // ==================== 第四步：向量化存储 ====================
    try {
      // 尝试获取已有向量存储并添加文档
      const vectorStore = await getVectorStore();
      // 添加带元数据的文档到向量存储
      await vectorStore.addDocuments(docsWithMetadata);
    } catch (error: any) {
      // 如果获取失败（集合不存在），创建新的向量存储
      console.log('向量存储不存在，创建新的存储...');
      await createVectorStoreFromDocs(docsWithMetadata);
    }

    // 返回处理成功结果
    return {
      success: true,
      documentId,
      title: filename,
      chunkCount: chunks.length,
    };
  } catch (error) {
    // 返回处理失败结果
    console.error('文档处理失败:', error);
    return {
      success: false,
      documentId,
      title: filename,
      chunkCount: 0,
      error: error instanceof Error ? error.message : '文档处理失败',
    };
  }
}
