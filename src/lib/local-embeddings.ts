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
 * - 支持 Serverless 部署：模型文件预打包，无需运行时下载
 * - 支持 CPU 运行，无需 GPU
 * 
 * 优势：
 * - 完全免费，无调用限制
 * - 数据隐私，文本不会上传到云端
 * - 离线可用，无需网络连接
 * - 响应速度快（本地计算）
 * - Serverless 友好，预打包模型文件
 */

import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';
import { pipeline, PipelineType, env } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';

// ==================== 环境配置 ====================

// 检测是否在 Serverless 环境
// 注意：vercel dev 也会设置 VERCEL=1，需要排除本地开发环境
const isServerless: boolean = !!(
  // Vercel 生产部署：VERCEL=1 且 VERCEL_ENV=production
  (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') ||
  // AWS Lambda
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  // Netlify 生产部署
  (process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production')
);

// 检测是否为本地开发环境（vercel dev 或 npm run dev）
const isLocalDev: boolean = !!(
  process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'development'
) || process.env.NODE_ENV === 'development';

// 检测是否在浏览器/客户端环境
const isBrowser = typeof window !== 'undefined';

// 是否强制使用远程模型（当本地模型不可用时）
const FORCE_REMOTE_MODELS = process.env.FORCE_REMOTE_MODELS === 'true';

// 调试日志
function debugLog(...args: any[]) {
  if (process.env.DEBUG_EMBEDDINGS === 'true' || isServerless) {
    console.log('[LocalEmbeddings]', ...args);
  }
}

/**
 * 获取可能的模型基础路径列表
 * Serverless 环境需要尝试多个路径
 */
function getPossibleModelPaths(): string[] {
  const paths: string[] = [];
  
  paths.push(
    path.join(process.cwd(), 'public', 'models'),
    path.join(process.cwd(), '.cache', 'transformers'),
  );

  if (isServerless) {
    paths.push(
      path.join('/var/task', 'public', 'models'),
      path.join(process.cwd(), '.next', 'standalone', 'public', 'models'),
      path.join('/var/task', '.next', 'standalone', 'public', 'models'),
      path.join('/tmp', 'models'),
    );
  }
  
  return paths;
}

/**
 * 查找实际存在的模型路径
 */
function findExistingModelPath(): string | null {
  const possiblePaths = getPossibleModelPaths();
  
  debugLog('检查以下路径:', possiblePaths);
  
  for (const basePath of possiblePaths) {
    // 检查是否有模型目录
    const modelDir = path.join(basePath, 'Xenova--bge-small-zh-v1.5');
    debugLog(`检查路径: ${modelDir}, 存在: ${fs.existsSync(modelDir)}`);
    
    if (fs.existsSync(modelDir)) {
      // 检查是否有模型文件
      const onnxDir = path.join(modelDir, 'onnx');
      if (fs.existsSync(onnxDir)) {
        const files = fs.readdirSync(onnxDir);
        const hasModelFile = files.some(f => f.endsWith('.onnx'));
        if (hasModelFile) {
          debugLog(`找到完整模型路径: ${basePath}`);
          return basePath;
        }
      }
    }
  }
  
  // 如果没有找到，记录警告并返回 null
  debugLog('警告: 未找到完整的模型文件');
  return null;
}

// 模型基础路径（延迟初始化）
let MODEL_BASE_PATH: string | null = null;
let MODEL_AVAILABLE: boolean = false;

/**
 * 获取模型基础路径（带缓存）
 */
function getModelBasePath(): string | null {
  if (!MODEL_BASE_PATH) {
    MODEL_BASE_PATH = findExistingModelPath();
    MODEL_AVAILABLE = MODEL_BASE_PATH !== null;
  }
  return MODEL_BASE_PATH;
}

/**
 * 检查模型是否可用
 */
export function isLocalModelAvailable(): boolean {
  getModelBasePath(); // 确保初始化
  return MODEL_AVAILABLE;
}

// 配置 Transformers.js 环境
if (typeof env !== 'undefined' && env) {
  // 在 Serverless 环境禁用远程模型下载，除非强制使用远程
  env.allowRemoteModels = !isServerless || FORCE_REMOTE_MODELS;
  env.allowLocalModels = true;
  
  // 配置 Hugging Face 镜像源（国内访问）
  const HF_MIRROR = process.env.HF_MIRROR || 'https://hf-mirror.com';
  // @ts-ignore - 设置镜像源
  env.remoteHost = HF_MIRROR;
}

// ==================== 类型定义 ====================

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
  /** 是否强制使用本地模型（Serverless 环境自动启用） */
  useLocalModels?: boolean;
}

// ==================== 模型路径映射 ====================

/**
 * 模型名称到本地路径的映射
 * 用于在 Serverless 环境中定位预下载的模型文件
 */
const MODEL_PATH_MAPPING: Record<string, string> = {
  'Xenova/bge-small-zh-v1.5': 'Xenova--bge-small-zh-v1.5',
  'Xenova/all-MiniLM-L6-v2': 'Xenova--all-MiniLM-L6-v2',
  'Xenova/gte-small': 'Xenova--gte-small',
};

/**
 * 获取模型的本地路径
 */
function getLocalModelPath(modelName: string): string | null {
  const localName = MODEL_PATH_MAPPING[modelName];
  if (!localName) return null;
  
  try {
    const basePath = getModelBasePath();
    if (!basePath) return null;
    
    const modelPath = path.join(basePath, localName);
    
    // 检查模型目录是否存在
    if (fs.existsSync(modelPath)) {
      // 检查是否有模型文件
      const onnxDir = path.join(modelPath, 'onnx');
      if (fs.existsSync(onnxDir)) {
        const files = fs.readdirSync(onnxDir);
        const hasModelFile = files.some(f => f.endsWith('.onnx'));
        if (hasModelFile) {
          return modelPath;
        }
      }
    }
  } catch (e) {
    debugLog('获取模型路径失败:', e);
  }
  
  return null;
}

/**
 * 检查模型是否在本地可用
 */
function isModelAvailableLocally(modelName: string): boolean {
  return getLocalModelPath(modelName) !== null;
}

/**
 * 为模型准备可写的目录（Serverless 环境）
 * 
 * Vercel 等 Serverless 平台的文件系统是只读的，需要将模型复制到 /tmp 目录
 * 同时创建符号链接桥接目录命名差异（Xenova--bge-small-zh-v1.5 → Xenova/bge-small-zh-v1.5）
 * 
 * @returns 准备好的模型基础目录，或 null
 */
function prepareWritableModelDir(modelName: string): string | null {
  const localName = MODEL_PATH_MAPPING[modelName];
  if (!localName) return null;
  
  try {
    // 在 Serverless 环境中，优先使用 /tmp 目录（可写）
    // 在本地开发环境，使用原始的 public/models 路径
    const basePath = isServerless ? '/tmp/models' : getModelBasePath();
    if (!basePath) return null;
    
    const sourcePath = isServerless 
      ? path.join(process.cwd(), 'public', 'models', localName)
      : path.join(basePath, localName);
    
    // 如果源路径不存在，跳过
    if (!fs.existsSync(sourcePath)) {
      debugLog(`源模型路径不存在: ${sourcePath}`);
      return isServerless ? basePath : null;
    }
    
    // 解析 modelName 创建目标目录结构 (Xenova/bge-small-zh-v1.5)
    const [org, model] = modelName.split('/');
    if (!org || !model) return null;
    
    const targetOrgDir = path.join(basePath, org);
    const targetPath = path.join(targetOrgDir, model);
    
    // 如果目标已存在（符号链接或目录），直接返回
    if (fs.existsSync(targetPath)) {
      debugLog(`模型目录已存在: ${targetPath}`);
      return basePath;
    }
    
    // 创建目标目录
    if (!fs.existsSync(targetOrgDir)) {
      fs.mkdirSync(targetOrgDir, { recursive: true });
      debugLog(`创建目录: ${targetOrgDir}`);
    }
    
    // 在 Serverless 环境中，尝试创建符号链接
    if (isServerless) {
      try {
        // 在 Linux/Vercel 上可以使用符号链接
        fs.symlinkSync(sourcePath, targetPath, 'dir');
        debugLog(`创建符号链接: ${targetPath} -> ${sourcePath}`);
      } catch (symlinkError: any) {
        // 符号链接失败（可能在某些环境），尝试复制目录
        if (symlinkError.code === 'EXDEV' || symlinkError.message?.includes('cross-device')) {
          debugLog(`符号链接失败（跨设备），复制目录...`);
          fs.cpSync(sourcePath, targetPath, { recursive: true });
          debugLog(`复制目录完成: ${targetPath}`);
        } else {
          throw symlinkError;
        }
      }
    } else {
      // 本地环境：创建符号链接或复制
      try {
        fs.symlinkSync(sourcePath, targetPath, 'junction');
        debugLog(`创建符号链接: ${targetPath} -> ${sourcePath}`);
      } catch (symlinkError) {
        debugLog(`符号链接失败，尝试复制目录...`);
        fs.cpSync(sourcePath, targetPath, { recursive: true });
        debugLog(`复制目录完成: ${targetPath}`);
      }
    }
    
    return basePath;
  } catch (e) {
    debugLog('准备模型目录失败:', e);
    return null;
  }
}

// ==================== LocalEmbeddings 类 ====================

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
  /** 是否强制使用本地模型 */
  private useLocalModels: boolean;
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
    this.modelName = params?.modelName ?? 'Xenova/bge-small-zh-v1.5';
    this.quantized = params?.quantized ?? true;
    this.batchSize = params?.batchSize ?? 1;
    this.downloadTimeout = params?.downloadTimeout ?? 5 * 60 * 1000; // 5分钟
    // Serverless 环境强制使用本地模型
    this.useLocalModels = params?.useLocalModels ?? isServerless;
    
    debugLog('初始化 LocalEmbeddings:', {
      modelName: this.modelName,
      isServerless,
      useLocalModels: this.useLocalModels,
      modelAvailable: isLocalModelAvailable(),
      cwd: process.cwd(),
    });
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
    debugLog(`正在加载模型: ${this.modelName}...`);

    try {
      const pipelineConfig: any = {
        quantized: this.quantized,
      };
      
      if (this.useLocalModels || isServerless) {
        const localPath = getLocalModelPath(this.modelName);
        
        if (localPath) {
          debugLog(`使用本地模型: ${localPath}`);
          
          // 在 Serverless 环境中准备可写的模型目录
          let cacheBasePath = getModelBasePath();
          if (isServerless) {
            const writablePath = prepareWritableModelDir(this.modelName);
            if (writablePath) {
              cacheBasePath = writablePath;
              debugLog(`Serverless 环境使用可写目录: ${writablePath}`);
            }
          }
          
          // 设置 Transformers.js 环境变量，指向模型基础目录
          if (cacheBasePath && typeof env !== 'undefined' && env) {
            env.cacheDir = cacheBasePath;
            // @ts-ignore
            env.localModelPath = cacheBasePath;
            
            // 禁用远程模型下载，强制使用本地文件
            if (isServerless) {
              env.allowRemoteModels = false;
            }
          }
          
          pipelineConfig.local_files_only = true;
        } else if (isServerless && !FORCE_REMOTE_MODELS) {
          const error = new Error(
            `模型文件不完整。请确保已运行: node scripts/download-models.js 并下载完整的模型文件（包括 .onnx 文件）。` +
            `或者设置环境变量 FORCE_REMOTE_MODELS=true 允许运行时下载（不推荐用于生产环境）。` +
            `当前工作目录: ${process.cwd()}`
          );
          throw error;
        }
      }
      
      if (!isServerless && !this.useLocalModels) {
        debugLog(`首次加载需要下载模型文件（约几十MB），请耐心等待...`);
      }

      debugLog('调用 pipeline()...');
      LocalEmbeddings.pipeline = await pipeline(
        'feature-extraction' as PipelineType,
        this.modelName,
        {
          ...pipelineConfig,
          progress_callback: (progress: any) => {
            if (progress.status === 'progress') {
              const percentage = Math.round((progress.loaded / progress.total) * 100);
              process.stdout.write(`\r[LocalEmbeddings] 加载进度: ${percentage}%`);
            } else if (progress.status === 'done') {
              console.log('\n[LocalEmbeddings] 模型加载完成！');
            }
          },
        }
      );

      debugLog('模型加载成功！');

      // 通知所有等待的调用者
      LocalEmbeddings.loadingQueue.forEach((resolve) => resolve(LocalEmbeddings.pipeline));
      LocalEmbeddings.loadingQueue = [];

      return LocalEmbeddings.pipeline;
    } catch (error: any) {
      console.error('[LocalEmbeddings] 模型加载失败:', error);
      
      // 创建友好的错误信息
      let errorMessage = '模型加载失败';
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage = '模型加载超时，请检查网络连接后重试';
      } else if (error.message?.includes('fetch') || error.message?.includes('download')) {
        errorMessage = '模型下载失败。Serverless 环境请确保已预下载模型: node scripts/download-models.js';
      } else if (error.message?.includes('ENOENT') || error.message?.includes('not found')) {
        errorMessage = `模型文件不存在: ${this.modelName}。请运行: node scripts/download-models.js`;
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

// ==================== 便捷函数 ====================

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
    quantized: true,
    downloadTimeout: 5 * 60 * 1000,
  });
}

/**
 * 检查模型是否已预下载
 * 
 * @param modelName - 模型名称
 * @returns boolean
 */
export function isModelDownloaded(modelName?: string): boolean {
  const name = modelName ?? RECOMMENDED_MODELS.CHINESE;
  return isModelAvailableLocally(name);
}

/**
 * 获取已下载的模型列表
 * 
 * @returns string[] 模型名称数组
 */
export function getDownloadedModels(): string[] {
  const models: string[] = [];
  
  for (const [modelName, localName] of Object.entries(MODEL_PATH_MAPPING)) {
    try {
      const basePath = getModelBasePath();
      if (!basePath) continue;
      
      const modelPath = path.join(basePath, localName);
      if (fs.existsSync(modelPath)) {
        models.push(modelName);
      }
    } catch (e) {
      // 忽略错误
    }
  }
  
  return models;
}

/**
 * 获取调试信息
 * 用于排查模型路径问题
 */
export function getDebugInfo(): object {
  const possiblePaths = getPossibleModelPaths();
  const pathInfo = possiblePaths.map(p => {
    const modelDir = path.join(p, 'Xenova--bge-small-zh-v1.5');
    const onnxDir = path.join(modelDir, 'onnx');
    let hasModelFile = false;
    
    if (fs.existsSync(onnxDir)) {
      try {
        const files = fs.readdirSync(onnxDir);
        hasModelFile = files.some(f => f.endsWith('.onnx'));
      } catch (e) {
        // 忽略错误
      }
    }
    
    return {
      path: p,
      exists: fs.existsSync(p),
      modelDirExists: fs.existsSync(modelDir),
      onnxDirExists: fs.existsSync(onnxDir),
      hasModelFile,
    };
  });
  
  return {
    isServerless,
    forceRemoteModels: FORCE_REMOTE_MODELS,
    modelAvailable: isLocalModelAvailable(),
    cwd: process.cwd(),
    env: {
      VERCEL: process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV,
      FORCE_REMOTE_MODELS: process.env.FORCE_REMOTE_MODELS,
    },
    paths: pathInfo,
    modelBasePath: MODEL_BASE_PATH,
  };
}
