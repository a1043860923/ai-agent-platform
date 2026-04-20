/**
 * 本地 Embedding 模型适配器 - LocalEmbeddings
 * 
 * 功能说明：
 * 1. 使用 Xenova Transformers 库加载本地开源 Embedding 模型
 * 2. 完全免费，无需 API 密钥，无需网络请求（首次下载除外）
 * 3. 支持多种开源模型：
 *    - Xenova/all-MiniLM-L6-v2: 英文场景，384维向量
 *    - Xenova/bge-small-zh-v1.5: 中文场景，512维向量（推荐）
 *    - Xenova/gte-small: 通用场景，384维向量
 * 
 * 技术细节：
 * - 使用 ONNX Runtime 在本地运行模型
 * - 首次加载时会自动下载模型文件（约几十MB）
 * - 后续使用本地缓存，无需重复下载
 * - 支持 CPU 运行，无需 GPU
 * 
 * 优势：
 * - 完全免费，无调用限制
 * - 数据隐私，文本不会上传到云端
 * - 离线可用，无需网络连接（首次下载后）
 * - 响应速度快（本地计算）
 */

import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';
import { pipeline, PipelineType, env } from '@xenova/transformers';

// 配置 Transformers.js 环境
// 设置本地缓存目录
env.cacheDir = './.cache/transformers';
// 允许从 Hugging Face 下载模型
env.allowLocalModels = true;
env.allowRemoteModels = true;

// 配置 Hugging Face 镜像源（国内访问）
// 使用 HF-Mirror 镜像站，无需翻墙即可下载模型
// 参考：https://hf-mirror.com/
const HF_MIRROR = process.env.HF_MIRROR || 'https://hf-mirror.com';
if (typeof env !== 'undefined' && env) {
  // @ts-ignore - 设置镜像源
  env.remoteHost = HF_MIRROR;
}

/**
 * 本地 Embedding 模型配置接口
 */
export interface LocalEmbeddingsParams extends EmbeddingsParams {
  /** 模型名称，默认使用中文优化的 bge-small-zh-v1.5 */
  modelName?: string;
  /** 是否使用量化模型（体积小、速度快），默认 true */
  quantized?: boolean;
  /** 批处理大小，默认 1 */
  batchSize?: number;
  /** 下载超时时间（毫秒），默认 5 分钟 */
  downloadTimeout?: number;
}

/**
 * 本地 Embedding 类
 * 
 * 实现 LangChain Embeddings 接口，兼容所有 LangChain 向量存储
 */
export class LocalEmbeddings extends Embeddings {
  /** 模型名称 */
  private modelName: string;
  /** 是否使用量化模型 */
  private quantized: boolean;
  /** 批处理大小 */
  private batchSize: number;
  /** 下载超时时间 */
  private downloadTimeout: number;
  /** 模型实例（单例模式） */
  private static pipeline: any = null;
  /** 模型加载状态 */
  private static isLoading: boolean = false;
  /** 模型加载等待队列 */
  private static loadingQueue: Array<(value: any) => void> = [];
  /** 加载错误 */
  private static loadError: Error | null = null;

  /**
   * 构造函数
   * 
   * @param params - 配置参数
   */
  constructor(params?: LocalEmbeddingsParams) {
    super(params ?? {});
    
    // 设置默认参数
    // 中文场景推荐使用 bge-small-zh-v1.5，英文场景可以使用 all-MiniLM-L6-v2
    this.modelName = params?.modelName ?? 'Xenova/bge-small-zh-v1.5';
    this.quantized = params?.quantized ?? true;
    this.batchSize = params?.batchSize ?? 1;
    this.downloadTimeout = params?.downloadTimeout ?? 5 * 60 * 1000; // 5分钟
  }

  /**
   * 获取或创建模型实例（单例模式）
   * 
   * 功能：确保全局只有一个模型实例，避免重复加载
   * 
   * @returns Promise<any> 模型实例
   */
  private async getPipeline(): Promise<any> {
    // 如果之前有加载错误，清除它（允许重试）
    if (LocalEmbeddings.loadError) {
      LocalEmbeddings.loadError = null;
      LocalEmbeddings.pipeline = null;
    }

    // 如果模型已加载，直接返回
    if (LocalEmbeddings.pipeline) {
      return LocalEmbeddings.pipeline;
    }

    // 如果模型正在加载，加入等待队列
    if (LocalEmbeddings.isLoading) {
      return new Promise((resolve, reject) => {
        LocalEmbeddings.loadingQueue.push((value: any) => {
          if (value instanceof Error) {
            reject(value);
          } else {
            resolve(value);
          }
        });
      });
    }

    // 标记开始加载
    LocalEmbeddings.isLoading = true;
    console.log(`[LocalEmbeddings] 正在加载模型: ${this.modelName}...`);
    console.log(`[LocalEmbeddings] 首次加载需要下载模型文件（约几十MB），请耐心等待...`);
    console.log(`[LocalEmbeddings] 如果下载失败，请检查网络连接或手动下载模型`);

    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.downloadTimeout);

      // 创建 feature-extraction pipeline
      // 这个 pipeline 用于将文本转换为向量
      LocalEmbeddings.pipeline = await pipeline(
        'feature-extraction' as PipelineType,  // 任务类型：特征提取
        this.modelName,                         // 模型名称
        {
          quantized: this.quantized,            // 是否使用量化模型
          // 进度回调，显示下载进度
          progress_callback: (progress: any) => {
            if (progress.status === 'progress') {
              const percentage = Math.round((progress.loaded / progress.total) * 100);
              console.log(`[LocalEmbeddings] 下载进度: ${percentage}%`);
            } else if (progress.status === 'done') {
              console.log(`[LocalEmbeddings] 模型加载完成！`);
            }
          },
        }
      );

      // 清除超时定时器
      clearTimeout(timeoutId);

      // 通知所有等待的调用者
      LocalEmbeddings.loadingQueue.forEach((resolve) => resolve(LocalEmbeddings.pipeline));
      LocalEmbeddings.loadingQueue = [];

      return LocalEmbeddings.pipeline;
    } catch (error: any) {
      console.error('[LocalEmbeddings] 模型加载失败:', error);
      
      // 创建友好的错误信息
      let errorMessage = '模型加载失败';
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage = '模型下载超时，请检查网络连接后重试';
      } else if (error.message?.includes('fetch')) {
        errorMessage = '网络请求失败，无法下载模型文件。请检查网络连接，或手动下载模型到 .cache/transformers 目录';
      } else if (error.message?.includes('ENOENT')) {
        errorMessage = '模型文件不存在，请确保网络连接正常以自动下载模型';
      } else {
        errorMessage = `模型加载失败: ${error.message || '未知错误'}`;
      }

      const enhancedError = new Error(errorMessage);
      LocalEmbeddings.loadError = enhancedError;
      
      // 通知所有等待的调用者（传递错误）
      LocalEmbeddings.loadingQueue.forEach((resolve) => resolve(enhancedError));
      LocalEmbeddings.loadingQueue = [];
      
      throw enhancedError;
    } finally {
      LocalEmbeddings.isLoading = false;
    }
  }

  /**
   * 将单个文本嵌入为向量
   * 
   * @param document - 输入文本
   * @returns Promise<number[]> 向量数组
   */
  async embedQuery(document: string): Promise<number[]> {
    try {
      const pipeline = await this.getPipeline();
      
      // 使用模型生成向量
      // pooling: 'mean' 表示使用均值池化
      // normalize: true 表示归一化向量
      const result = await pipeline(document, {
        pooling: 'mean',
        normalize: true,
      });

      // 返回向量数据
      return Array.from(result.data);
    } catch (error: any) {
      console.error('[LocalEmbeddings] 文本嵌入失败:', error);
      throw new Error(`文本嵌入失败: ${error.message || '未知错误'}`);
    }
  }

  /**
   * 将多个文本批量嵌入为向量
   * 
   * @param documents - 文本数组
   * @returns Promise<number[][]> 向量数组的数组
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    try {
      const pipeline = await this.getPipeline();
      const embeddings: number[][] = [];

      // 批量处理文档
      for (let i = 0; i < documents.length; i += this.batchSize) {
        const batch = documents.slice(i, i + this.batchSize);
        
        // 批量生成向量
        const results = await Promise.all(
          batch.map((doc) =>
            pipeline(doc, {
              pooling: 'mean',
              normalize: true,
            })
          )
        );

        // 提取向量数据
        results.forEach((result) => {
          embeddings.push(Array.from(result.data));
        });
      }

      return embeddings;
    } catch (error: any) {
      console.error('[LocalEmbeddings] 批量嵌入失败:', error);
      throw new Error(`批量嵌入失败: ${error.message || '未知错误'}`);
    }
  }
}

/**
 * 推荐的模型列表
 */
export const RECOMMENDED_MODELS = {
  /** 中文场景推荐（512维向量） */
  CHINESE: 'Xenova/bge-small-zh-v1.5',
  /** 英文场景推荐（384维向量） */
  ENGLISH: 'Xenova/all-MiniLM-L6-v2',
  /** 通用场景推荐（384维向量） */
  GENERAL: 'Xenova/gte-small',
  /** 高性能中文模型（768维向量，体积较大） */
  CHINESE_LARGE: 'Xenova/bge-base-zh-v1.5',
};

/**
 * 创建本地 Embedding 实例的便捷函数
 * 
 * @param modelName - 模型名称，默认使用中文模型
 * @returns LocalEmbeddings 实例
 */
export function createLocalEmbeddings(modelName?: string): LocalEmbeddings {
  return new LocalEmbeddings({
    modelName: modelName ?? RECOMMENDED_MODELS.CHINESE,
    quantized: true,  // 使用量化模型，体积更小、速度更快
    downloadTimeout: 5 * 60 * 1000, // 5分钟超时
  });
}
