/**
 * 文档文本块 API 路由 - /api/documents/[id]/chunks
 * 
 * 功能说明：
 * 1. 获取指定文档的所有文本块
 * 2. 从向量数据库中检索文档的分块内容
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15 中 params 是 Promise，需要使用 await 解包
    const { id } = await params;
    
    console.log('获取文档文本块, ID:', id);
    
    // 从本地文件读取所有条目
    const entries = await getAllEntries();
    
    console.log('总条目数:', entries.length);
    
    // 提取文档标题（ID格式：collectionName-title）
    const decodedId = decodeURIComponent(id);
    const lastDashIndex = decodedId.lastIndexOf('-');
    const targetTitle = lastDashIndex > 0 ? decodedId.slice(lastDashIndex + 1) : decodedId;
    
    console.log('目标文档标题:', targetTitle);
    
    // 打印前几个条目标题用于调试
    if (entries.length > 0) {
      console.log('存储的标题示例:', entries.slice(0, 3).map((e: any) => e.metadata?.title));
    }
    
    // 过滤出属于该文档的条目
    const docEntries = entries.filter((entry: any) => {
      const entryTitle = entry.metadata?.title || '';
      return entryTitle === targetTitle || 
             entryTitle.includes(targetTitle) || 
             targetTitle.includes(entryTitle);
    });
    
    console.log('匹配到的条目数:', docEntries.length);

    const chunks = docEntries.map((entry: any, idx: number) => ({
      id: idx,
      content: entry.content,
      metadata: entry.metadata,
    }));

    return NextResponse.json({
      chunks,
      total: chunks.length,
    });
  } catch (error: any) {
    console.error('获取文档文本块失败:', error);
    return NextResponse.json(
      { error: '获取文档文本块失败', message: error?.message || String(error), chunks: [] },
      { status: 500 }
    );
  }
}

async function getAllEntries(): Promise<any[]> {
  const persistDir = process.env.CHROMA_PERSIST_DIR || './chroma-data';
  const absolutePath = path.resolve(persistDir);
  
  const entries: any[] = [];
  
  try {
    if (!fs.existsSync(absolutePath)) {
      console.log('向量存储目录不存在:', absolutePath);
      return entries;
    }
    
    const files = fs.readdirSync(absolutePath);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(absolutePath, file);
        try {
          const data = fs.readFileSync(filePath, 'utf-8');
          const fileEntries = JSON.parse(data);
          if (Array.isArray(fileEntries)) {
            entries.push(...fileEntries);
          }
        } catch (error) {
          console.error(`读取文件失败 ${file}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('读取向量存储失败:', error);
  }
  
  return entries;
}
