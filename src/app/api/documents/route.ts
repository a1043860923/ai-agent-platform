/**
 * 文档管理API路由 - /api/documents
 *
 * 功能说明：
 * 1. GET: 获取文档列表
 * 2. DELETE: 删除指定文档
 *
 * GET /api/documents
 * 响应：文档列表
 *
 * DELETE /api/documents?documentId=xxx
 * 响应：删除结果
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET 处理函数 - 获取文档列表
 *
 * 功能：从本地存储获取所有文档的元数据信息
 * 包括文档标题、类型、大小、上传时间等
 *
 * @param req - Next.js请求对象
 * @returns NextResponse 包含文档列表的响应
 */
export async function GET(req: NextRequest) {
  try {
    // 从本地文件读取文档列表
    const documents = await getDocumentsFromStorage();

    return NextResponse.json({
      documents,
      total: documents.length,
      message: '文档列表获取成功',
    });
  } catch (error) {
    console.error('获取文档列表失败:', error);
    return NextResponse.json(
      { error: '获取文档列表失败', documents: [] },
      { status: 500 }
    );
  }
}

/**
 * DELETE 处理函数 - 删除文档
 *
 * 功能：从本地存储中删除指定文档的向量数据
 *
 * @param req - Next.js请求对象
 * @returns NextResponse 删除结果
 */
export async function DELETE(req: NextRequest) {
  try {
    // 从URL参数中获取文档ID
    const documentId = req.nextUrl.searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: '缺少文档ID参数' },
        { status: 400 }
      );
    }

    // 解析文档ID（格式：collectionName-title）
    const decodedId = decodeURIComponent(documentId);
    const lastDashIndex = decodedId.lastIndexOf('-');
    const targetTitle = lastDashIndex > 0 ? decodedId.slice(lastDashIndex + 1) : decodedId;

    // 从本地存储中删除文档
    const deleted = await deleteDocumentFromStorage(targetTitle);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: `文档 ${targetTitle} 已删除`,
      });
    } else {
      return NextResponse.json(
        { error: '文档不存在或删除失败' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('删除文档失败:', error);
    return NextResponse.json(
      { error: '删除文档失败' },
      { status: 500 }
    );
  }
}

/**
 * 从本地存储获取文档列表
 */
async function getDocumentsFromStorage(): Promise<Array<{
  id: string;
  title: string;
  chunkCount: number;
  uploadedAt: string;
  size: number;
}>> {
  const persistDir = process.env.CHROMA_PERSIST_DIR || './chroma-data';
  const absolutePath = path.resolve(persistDir);

  const documents: Array<{
    id: string;
    title: string;
    chunkCount: number;
    uploadedAt: string;
    size: number;
  }> = [];

  try {
    if (!fs.existsSync(absolutePath)) {
      return documents;
    }

    const files = fs.readdirSync(absolutePath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const collectionName = file.replace('.json', '');
        const filePath = path.join(absolutePath, file);

        try {
          const data = fs.readFileSync(filePath, 'utf-8');
          const entries = JSON.parse(data);

          if (Array.isArray(entries)) {
            // 按文档标题分组统计
            const docMap = new Map<string, { count: number; timestamp: number; size: number }>();

            for (const entry of entries) {
              const title = entry.metadata?.title || '未命名文档';
              const timestamp = entry.metadata?.uploadTime || entry.metadata?.timestamp || Date.now();
              const size = entry.metadata?.size || 0;

              if (docMap.has(title)) {
                const existing = docMap.get(title)!;
                existing.count++;
                existing.size += size;
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
          }
        } catch (error) {
          console.error(`读取文件失败 ${file}:`, error);
        }
      }
    }

    // 按上传时间倒序排列
    documents.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  } catch (error) {
    console.error('读取文档列表失败:', error);
  }

  return documents;
}

/**
 * 从本地存储删除文档
 * @param targetTitle - 要删除的文档标题
 * @returns 是否删除成功
 */
async function deleteDocumentFromStorage(targetTitle: string): Promise<boolean> {
  const persistDir = process.env.CHROMA_PERSIST_DIR || './chroma-data';
  const absolutePath = path.resolve(persistDir);

  try {
    if (!fs.existsSync(absolutePath)) {
      return false;
    }

    const files = fs.readdirSync(absolutePath);
    let deleted = false;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(absolutePath, file);

        try {
          const data = fs.readFileSync(filePath, 'utf-8');
          const entries = JSON.parse(data);

          if (Array.isArray(entries)) {
            // 过滤掉要删除的文档条目
            const filteredEntries = entries.filter((entry: any) => {
              const entryTitle = entry.metadata?.title || '';
              // 不匹配则保留（即删除匹配的）
              const shouldKeep = entryTitle !== targetTitle &&
                                !entryTitle.includes(targetTitle) &&
                                !targetTitle.includes(entryTitle);
              if (!shouldKeep) {
                deleted = true;
                console.log(`删除条目: ${entryTitle}`);
              }
              return shouldKeep;
            });

            // 如果有条目被删除，写回文件
            if (filteredEntries.length !== entries.length) {
              if (filteredEntries.length === 0) {
                // 如果文件为空，删除整个文件
                fs.unlinkSync(filePath);
                console.log(`删除空文件: ${file}`);
              } else {
                // 写回过滤后的数据
                fs.writeFileSync(filePath, JSON.stringify(filteredEntries, null, 2));
                console.log(`更新文件: ${file}, 剩余条目: ${filteredEntries.length}`);
              }
            }
          }
        } catch (error) {
          console.error(`处理文件失败 ${file}:`, error);
        }
      }
    }

    return deleted;
  } catch (error) {
    console.error('删除文档失败:', error);
    return false;
  }
}
