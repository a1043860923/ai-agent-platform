/**
 * 调试 API 路由
 * 用于检查 Serverless 环境中的模型文件路径
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDebugInfo } from '@/lib/local-embeddings';

export async function GET(req: NextRequest) {
  try {
    const debugInfo = getDebugInfo();
    
    return NextResponse.json({
      success: true,
      ...debugInfo,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      cwd: process.cwd(),
      env: {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
      },
    }, { status: 500 });
  }
}
