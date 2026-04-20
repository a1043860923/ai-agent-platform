/**
 * 文档列表 API 路由 - /api/documents/list
 * 
 * 功能说明：
 * 1. 获取向量数据库中已存储的所有文档列表
 * 2. 从本地文件系统读取 chroma-data 目录中的集合文件
 * 3. 返回文档的基本信息（ID、标题、分块数量等）
 * 
 * 响应格式：
 * {
 *   documents: Array<{
 *     id: string,
 *     title: string,
 *     chunkCount: number,
 *     uploadedAt: string
 *   }>
 * }
 */

import { NextResponse } from 'next/server';
import { listCollections, getVectorStore } from '@/lib/vector-store';
import fs from 'fs';
import path from 'path';

/**
 * GET 处理函数 - 获取文档列表
 * 
 * @returns NextResponse 响应对象
 */
export async function GET() {
  try {
    // 获取所有集合名称
    const collections = await listCollections();
    
    if (collections.length === 0) {
      return NextResponse.json({
        documents: [],
        message: '暂无文档',
      });
    }

    // 读取向量数据目录获取文档信息
    const persistDir = process.env.CHROMA_PERSIST_DIR || './chroma-data';
    const absolutePath = path.resolve(persistDir);
    
    const documents: Array<{
      id: string;
      title: string;
      chunkCount: number;
      uploadedAt: string;
      size: number;
    }> = [];

    // 遍历所有集合文件
    for (const collectionName of collections) {
      const filePath = path.join(absolutePath, `${collectionName}.json`);
      
      if (fs.existsSync(filePath)) {
        try {
          const data = fs.readFileSync(filePath, 'utf-8');
          const entries = JSON.parse(data);
          
          // 从集合中提取文档信息
          // 按文档标题分组统计
          const docMap = new Map<string, { count: number; timestamp: number; size: number }>();

          for (const entry of entries) {
            const title = entry.metadata?.title || '未命名文档';
            const timestamp = entry.metadata?.uploadTime || entry.metadata?.timestamp || Date.now();
            const size = entry.metadata?.size || 0;

            if (docMap.has(title)) {
              const existing = docMap.get(title)!;
              existing.count++;
              // 累加文件大小
              existing.size += size;
              // 使用最早的时间戳
              if (timestamp < existing.timestamp) {
                existing.timestamp = timestamp;
              }
            } else {
              docMap.set(title, { count: 1, timestamp, size });
            }
          }

          // 转换为数组格式
          for (const [title, info] of docMap.entries()) {
            documents.push({
              id: `${collectionName}-${title}`,
              title,
              chunkCount: info.count,
              uploadedAt: new Date(info.timestamp).toISOString(),
              size: info.size,
            });
          }
        } catch (error) {
          console.error(`读取集合 "${collectionName}" 失败:`, error);
        }
      }
    }

    // 按上传时间倒序排列
    documents.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return NextResponse.json({
      documents,
      total: documents.length,
    });
  } catch (error) {
    console.error('获取文档列表失败:', error);
    return NextResponse.json(
      { error: '获取文档列表失败', documents: [] },
      { status: 500 }
    );
  }
}
