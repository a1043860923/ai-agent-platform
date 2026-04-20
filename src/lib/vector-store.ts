/**
 * 向量数据库管理模块 - VectorStore
 * 
 * 功能说明：
 * 1. 初始化并管理ChromaDB向量数据库连接
 * 2. 提供向量存储和检索功能
 * 3. 支持文档的增删改查操作
 * 4. 使用本地开源Embedding模型生成文本向量（完全免费）
 * 
 * 技术细节：
 * - 使用 @langchain/community 的 Chroma 向量存储适配器
 * - 使用本地 Embedding 模型（Xenova/bge-small-zh），无需API密钥
 * - 支持相似度检索（similarity search）
 * - 支持最大边际相关性检索（MMR），提高结果多样性
 * - 使用内存模式运行，无需Docker（数据持久化到本地JSON文件）
 * 
 * 优势：
 * - 完全免费，无调用限制
 * - 数据隐私，文本不会上传到云端
 * - 离线可用，无需网络连接
 * - 响应速度快（本地计算）
 * - 无需Docker，一键启动
 */

import { Document } from '@langchain/core/documents';
import { LocalEmbeddings, createLocalEmbeddings } from './local-embeddings';
import path from 'path';
import fs from 'fs';

// 向量数据存储目录
const VECTOR_STORE_DIR = process.env.CHROMA_PERSIST_DIR || './chroma-data';

/**
 * 确保存储目录存在
 */
function ensureStoreDir(): string {
  const absolutePath = path.resolve(VECTOR_STORE_DIR);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
  return absolutePath;
}

/**
 * 获取集合的存储文件路径
 */
function getCollectionPath(collectionName: string): string {
  const storeDir = ensureStoreDir();
  return path.join(storeDir, `${collectionName}.json`);
}

/**
 * 内存中的向量存储缓存
 * key: collectionName, value: 向量数据数组
 */
const vectorCache: Map<string, VectorEntry[]> = new Map();

/**
 * 向量条目接口
 */
interface VectorEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

/**
 * 从文件加载向量数据
 */
function loadFromFile(collectionName: string): VectorEntry[] {
  const filePath = getCollectionPath(collectionName);
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`加载集合 "${collectionName}" 失败:`, error);
      return [];
    }
  }
  return [];
}

/**
 * 保存向量数据到文件
 */
function saveToFile(collectionName: string, entries: VectorEntry[]): void {
  const filePath = getCollectionPath(collectionName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (error) {
    console.error(`保存集合 "${collectionName}" 失败:`, error);
  }
}

/**
 * 获取Embedding模型实例
 * 
 * 功能：创建本地Embedding模型实例
 * 使用 Xenova Transformers 库加载本地开源模型
 * 
 * @returns LocalEmbeddings 本地Embedding实例
 */
function getEmbeddings(): LocalEmbeddings {
  // 创建本地Embedding实例
  // 使用中文优化的 bge-small-zh-v1.5 模型（v1.5版本更稳定）
  return createLocalEmbeddings('Xenova/bge-small-zh-v1.5');
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 自定义向量存储类（基于本地文件）
 * 替代 ChromaDB，无需任何外部服务
 */
class LocalVectorStore {
  private collectionName: string;
  private embeddings: LocalEmbeddings;

  constructor(collectionName: string, embeddings: LocalEmbeddings) {
    this.collectionName = collectionName;
    this.embeddings = embeddings;
  }

  /**
   * 添加文档到向量存储
   */
  async addDocuments(docs: Document[]): Promise<void> {
    const entries = vectorCache.get(this.collectionName) || loadFromFile(this.collectionName);
    
    for (const doc of docs) {
      // 生成向量
      const embedding = await this.embeddings.embedQuery(doc.pageContent);
      
      // 创建条目
      const entry: VectorEntry = {
        id: crypto.randomUUID(),
        content: doc.pageContent,
        embedding,
        metadata: doc.metadata,
      };
      
      entries.push(entry);
    }
    
    // 更新缓存并保存到文件
    vectorCache.set(this.collectionName, entries);
    saveToFile(this.collectionName, entries);
  }

  /**
   * 相似度检索
   */
  async similaritySearch(query: string, k: number = 3): Promise<Document[]> {
    const entries = vectorCache.get(this.collectionName) || loadFromFile(this.collectionName);
    
    if (entries.length === 0) {
      return [];
    }
    
    // 计算查询向量
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    // 计算相似度并排序
    const similarities = entries.map(entry => ({
      entry,
      similarity: cosineSimilarity(queryEmbedding, entry.embedding),
    }));
    
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // 返回前k个结果
    return similarities.slice(0, k).map(({ entry }) => new Document({
      pageContent: entry.content,
      metadata: entry.metadata,
    }));
  }

  /**
   * 删除集合
   */
  async deleteCollection(): Promise<void> {
    vectorCache.delete(this.collectionName);
    const filePath = getCollectionPath(this.collectionName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * 获取向量存储实例
 * 
 * 功能：创建或获取已存在的向量存储实例
 * 使用本地文件存储，无需Docker或外部服务
 * 
 * @param collectionName - 集合名称，默认为环境变量中的配置或'documents'
 * @returns Promise<LocalVectorStore> 返回向量存储实例
 */
export async function getVectorStore(collectionName?: string): Promise<LocalVectorStore> {
  const collName = collectionName || process.env.CHROMA_COLLECTION_NAME || 'documents';
  const embeddings = getEmbeddings();
  
  // 确保集合数据已加载到缓存
  if (!vectorCache.has(collName)) {
    const entries = loadFromFile(collName);
    vectorCache.set(collName, entries);
    console.log(`集合 "${collName}" 已加载，包含 ${entries.length} 条记录`);
  }
  
  return new LocalVectorStore(collName, embeddings);
}

/**
 * 创建新的向量存储（从文档创建）
 * 
 * 功能：将文档列表直接向量化并存储
 * 适用于首次创建集合或批量导入文档的场景
 * 
 * @param docs - LangChain Document对象数组
 * @param collectionName - 集合名称
 * @returns Promise<LocalVectorStore> 返回创建好的向量存储实例
 */
export async function createVectorStoreFromDocs(
  docs: Document[],
  collectionName?: string
): Promise<LocalVectorStore> {
  const collName = collectionName || process.env.CHROMA_COLLECTION_NAME || 'documents';
  const embeddings = getEmbeddings();
  
  // 清空现有数据
  vectorCache.delete(collName);
  const filePath = getCollectionPath(collName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // 创建新的向量存储
  const store = new LocalVectorStore(collName, embeddings);
  
  // 添加文档
  if (docs.length > 0) {
    await store.addDocuments(docs);
  }
  
  console.log(`集合 "${collName}" 创建完成，包含 ${docs.length} 条记录`);
  return store;
}

/**
 * 相似度检索
 * 
 * 功能：根据查询文本检索最相似的文档片段
 * 
 * @param query - 查询文本
 * @param k - 返回结果数量，默认为3
 * @param collectionName - 集合名称
 * @returns Promise<Document[]> 返回相似文档数组
 */
export async function similaritySearch(
  query: string,
  k: number = 3,
  collectionName?: string
): Promise<Document[]> {
  try {
    const store = await getVectorStore(collectionName);
    return await store.similaritySearch(query, k);
  } catch (error) {
    console.error('相似度检索失败:', error);
    return [];
  }
}

/**
 * 最大边际相关性检索（MMR）
 * 
 * 功能：在保证相关性的同时，提高检索结果的多样性
 * 避免返回内容过于相似的文档片段
 * 
 * @param query - 查询文本
 * @param k - 最终返回结果数量，默认为3
 * @param fetchK - 候选集数量（从中选择k个），默认为20
 * @param lambda - 多样性参数，0=最大多样性，1=最大相关性，默认0.5
 * @param collectionName - 集合名称
 * @returns Promise<Document[]> 返回多样化的相似文档数组
 */
export async function mmrSearch(
  query: string,
  k: number = 3,
  fetchK: number = 20,
  lambda: number = 0.5,
  collectionName?: string
): Promise<Document[]> {
  try {
    // 先获取fetchK个候选结果
    const candidates = await similaritySearch(query, fetchK, collectionName);
    
    if (candidates.length <= k) {
      return candidates;
    }
    
    // 简化的MMR实现：基于内容的多样性选择
    const selected: Document[] = [candidates[0]];
    const remaining = candidates.slice(1);
    
    while (selected.length < k && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        // 计算与查询的相似度（简化处理）
        const relevanceScore = 1 - (i / remaining.length);
        
        // 计算与已选结果的最大相似度
        let maxSim = 0;
        for (const sel of selected) {
          const sim = calculateTextSimilarity(remaining[i].pageContent, sel.pageContent);
          maxSim = Math.max(maxSim, sim);
        }
        
        // MMR分数
        const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSim;
        
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }
      
      selected.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }
    
    return selected;
  } catch (error) {
    console.error('MMR检索失败:', error);
    return [];
  }
}

/**
 * 计算文本相似度（简化版，用于MMR）
 */
function calculateTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return intersection.size / union.size;
}

/**
 * 删除集合中的所有文档
 * 
 * 功能：清空指定集合的所有向量数据
 * 
 * @param collectionName - 集合名称
 */
export async function deleteCollection(collectionName?: string): Promise<void> {
  try {
    const collName = collectionName || process.env.CHROMA_COLLECTION_NAME || 'documents';
    
    // 从缓存中删除
    vectorCache.delete(collName);
    
    // 删除文件
    const filePath = getCollectionPath(collName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.log(`集合 "${collName}" 已删除`);
  } catch (error) {
    console.error('删除集合失败:', error);
  }
}

/**
 * 列出所有集合
 * 
 * 功能：获取所有集合的列表
 * 
 * @returns Promise<string[]> 返回集合名称数组
 */
export async function listCollections(): Promise<string[]> {
  try {
    const storeDir = ensureStoreDir();
    const files = fs.readdirSync(storeDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (error) {
    console.error('列出集合失败:', error);
    return [];
  }
}
