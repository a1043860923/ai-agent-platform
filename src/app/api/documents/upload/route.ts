/**
 * 文档上传API路由 - /api/documents/upload
 * 
 * 功能说明：
 * 1. 接收上传的PDF/Markdown文件
 * 2. 解析文档内容
 * 3. 将文本分割为小块
 * 4. 向量化并存储到ChromaDB
 * 5. 返回处理结果
 * 
 * 请求格式：
 * POST /api/documents/upload
 * Content-Type: multipart/form-data
 * Body: { file: File }
 * 
 * 响应格式：
 * {
 *   success: boolean,
 *   documentId: string,
 *   title: string,
 *   chunkCount: number,
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDocument } from '@/lib/document-processor';

/**
 * 最大文件大小（10MB）
 * 从环境变量读取，默认10MB
 */
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);

/**
 * 支持的文件MIME类型
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',                    // PDF文件
  'text/markdown',                      // Markdown文件
  'text/x-markdown',                    // Markdown文件（替代MIME类型）
];

/**
 * 支持的文件扩展名
 */
const ALLOWED_EXTENSIONS = ['.pdf', '.md', '.markdown'];

/**
 * POST 处理函数 - 处理文件上传
 * 
 * @param req - Next.js请求对象
 * @returns NextResponse 响应对象
 */
export async function POST(req: NextRequest) {
  try {
    // ==================== 解析请求 ====================
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    // 验证文件是否存在
    if (!file) {
      return NextResponse.json(
        { error: '未找到上传文件，请选择文件后重试' },
        { status: 400 }
      );
    }

    // ==================== 验证文件类型 ====================
    const fileName = file.name.toLowerCase();
    const fileExtension = '.' + fileName.split('.').pop();
    const isAllowedMimeType = ALLOWED_MIME_TYPES.includes(file.type);
    const isAllowedExtension = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isAllowedMimeType && !isAllowedExtension) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type || fileExtension}。仅支持 PDF 和 Markdown 格式。` },
        { status: 400 }
      );
    }

    // ==================== 验证文件大小 ====================
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `文件大小超出限制。最大允许 ${maxSizeMB}MB，当前文件 ${fileSizeMB}MB。` },
        { status: 400 }
      );
    }

    // ==================== 读取文件内容 ====================
    const buffer = Buffer.from(await file.arrayBuffer());

    // ==================== 处理文档 ====================
    const result = await processDocument(
      buffer,
      file.name,
      file.type,
      file.size
    );

    // ==================== 返回结果 ====================
    if (result.success) {
      return NextResponse.json({
        success: true,
        documentId: result.documentId,
        title: result.title,
        chunkCount: result.chunkCount,
        message: `文档 "${result.title}" 处理成功，共分割为 ${result.chunkCount} 个文本块。`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          documentId: result.documentId,
          title: result.title,
          chunkCount: 0,
          error: result.error || '文档处理失败',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('文件上传API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}
