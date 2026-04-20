/**
 * Next.js 配置文件
 * 
 * 配置说明：
 * - 移除了 output: 'export'，因为API路由需要服务端运行
 * - 配置了服务器外部包，避免Webpack打包ChromaDB等Node.js原生模块
 * - 图片配置保持未优化状态
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 服务器外部包配置
   * 这些包会在Node.js运行时直接引用，而不是被Webpack打包
   * 这对于包含原生代码的包（如ChromaDB客户端）是必需的
   */
  serverExternalPackages: [
    'chromadb',       // ChromaDB向量数据库客户端
    'pdf-parse',      // PDF解析库
    'langchain',      // LangChain AI框架
  ],

  /**
   * 图片配置
   * 由于不使用Next.js的图片优化服务，设置为未优化
   */
  images: {
    unoptimized: true,
  },

  /**
   * 实验性配置
   * serverActions 允许服务端操作
   */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',  // 限制请求体大小为10MB（支持大文件上传）
    },
  },
};

export default nextConfig;
