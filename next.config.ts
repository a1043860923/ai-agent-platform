/**
 * Next.js 配置文件
 * 
 * 配置说明：
 * - 移除了 output: 'export'，因为API路由需要服务端运行
 * - 配置了服务器外部包，避免Webpack打包ChromaDB等Node.js原生模块
 * - 图片配置保持未优化状态
 * - 配置静态资源输出，支持预下载的模型文件
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

  /**
   * Turbopack 配置
   * Next.js 16 默认使用 Turbopack，需要显式配置
   */
  turbopack: {
    // 使用 webpack 加载器规则处理模型文件
    rules: [
      {
        test: /\.(onnx|bin)$/,
        include: /public[\/]models/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'static/models/[name].[ext]',
            },
          },
        ],
      },
    ],
  },

  /**
   * 静态资源配置
   * 确保模型文件被正确复制到输出目录
   */
  async headers() {
    return [
      {
        // 为模型文件配置缓存头
        source: '/models/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 长期缓存
          },
        ],
      },
    ];
  },

  /**
   * Webpack 配置
   * 处理模型文件和其他特殊资源（Turbopack 不支持时回退使用）
   */
  webpack: (config, { isServer, nextRuntime }) => {
    // 配置模型文件的加载
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];

    // 处理 .onnx 模型文件
    config.module.rules.push({
      test: /\.(onnx|bin|json)$/,
      include: /public[\/]models/,
      type: 'asset/resource',
      generator: {
        filename: 'static/models/[name][ext]',
      },
    });

    // 忽略 fs 模块在客户端的警告
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    return config;
  },

  /**
   * 输出配置
   * standalone 模式用于 Docker 和 Serverless 部署
   */
  output: 'standalone',

  /**
   * 环境变量配置
   * 这些变量将在构建时可用
   */
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
