/**
 * 模型预下载脚本
 * 
 * 功能：在构建时预下载 Embedding 模型文件，打包到项目中
 * 解决 Serverless 环境无法运行时下载模型的问题
 * 
 * 使用方法：
 * node scripts/download-models.js
 * 
 * 或在 package.json 中添加：
 * "prebuild": "node scripts/download-models.js"
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 模型配置
const MODELS = [
  {
    name: 'Xenova/bge-small-zh-v1.5',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',  // 量化版本，体积小
    ]
  }
];

// 模型存储目录
const MODELS_DIR = path.join(process.cwd(), 'public', 'models');

// Hugging Face 镜像源
const HF_MIRROR = process.env.HF_MIRROR || 'https://hf-mirror.com';

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[Download] 创建目录: ${dir}`);
  }
}

/**
 * 下载单个文件（支持重定向）
 */
function downloadFile(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('重定向次数过多'));
      return;
    }

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    console.log(`[Download] 下载: ${url}`);
    console.log(`[Download] 目标: ${dest}`);
    
    // 确保目标目录存在
    ensureDir(path.dirname(dest));
    
    const file = fs.createWriteStream(dest);
    
    const request = protocol.get(url, { 
      timeout: 300000, // 5分钟超时（模型文件较大）
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        console.log(`[Download] 跟随重定向`);
        const redirectUrl = new URL(response.headers.location, url).toString();
        downloadFile(redirectUrl, dest, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;
      let lastProgress = -1;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          if (progress !== lastProgress) {
            process.stdout.write(`\r[Download] 进度: ${progress}% (${(downloadedSize/1024/1024).toFixed(1)}/${(totalSize/1024/1024).toFixed(1)} MB)`);
            lastProgress = progress;
          }
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(' ✓');
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      reject(err);
    });

    request.on('timeout', () => {
      request.destroy();
      file.close();
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      reject(new Error('请求超时'));
    });
  });
}

/**
 * 下载模型
 */
async function downloadModel(modelConfig) {
  const { name, files } = modelConfig;
  const modelDir = path.join(MODELS_DIR, name.replace('/', '--'));
  
  ensureDir(modelDir);
  
  console.log(`\n[Download] 开始下载模型: ${name}`);
  console.log(`[Download] 存储位置: ${modelDir}`);
  
  for (const file of files) {
    const url = `${HF_MIRROR}/${name}/resolve/main/${file}`;
    const dest = path.join(modelDir, file);
    
    // 如果文件已存在，跳过
    if (fs.existsSync(dest)) {
      const stats = fs.statSync(dest);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`[Download] 文件已存在，跳过: ${file} (${sizeMB} MB)`);
      continue;
    }
    
    try {
      await downloadFile(url, dest);
    } catch (error) {
      console.error(`\n[Download] 下载失败: ${file}`);
      console.error(`[Download] 错误: ${error.message}`);
      
      // 如果量化模型下载失败，尝试下载非量化版本
      if (file === 'onnx/model_quantized.onnx') {
        console.log('[Download] 尝试下载非量化版本...');
        try {
          const nonQuantizedUrl = `${HF_MIRROR}/${name}/resolve/main/onnx/model.onnx`;
          const nonQuantizedDest = path.join(modelDir, 'onnx', 'model.onnx');
          await downloadFile(nonQuantizedUrl, nonQuantizedDest);
        } catch (e) {
          console.error('[Download] 非量化版本也下载失败');
        }
      }
    }
  }
  
  console.log(`[Download] 模型 ${name} 处理完成`);
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('  Embedding 模型预下载工具');
  console.log('========================================');
  console.log(`[Config] 使用镜像源: ${HF_MIRROR}`);
  console.log(`[Config] 模型存储目录: ${MODELS_DIR}`);
  
  try {
    for (const model of MODELS) {
      await downloadModel(model);
    }
    
    console.log('\n========================================');
    console.log('  所有模型下载完成！');
    console.log('========================================');
    
    // 显示模型总大小
    const getFolderSize = (dir) => {
      let size = 0;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            size += getFolderSize(filePath);
          } else {
            size += stats.size;
          }
        }
      } catch (e) {
        // 目录可能不存在
      }
      return size;
    };
    
    const totalSize = getFolderSize(MODELS_DIR);
    console.log(`[Info] 模型总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // 列出已下载的文件
    console.log('\n[Info] 已下载的模型文件:');
    for (const model of MODELS) {
      const modelDir = path.join(MODELS_DIR, model.name.replace('/', '--'));
      if (fs.existsSync(modelDir)) {
        console.log(`  ${model.name}:`);
        const listFiles = (dir, prefix = '    ') => {
          const items = fs.readdirSync(dir);
          items.forEach(item => {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
              console.log(`${prefix}📁 ${item}/`);
              listFiles(itemPath, prefix + '  ');
            } else {
              const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
              console.log(`${prefix}📄 ${item} (${sizeMB} MB)`);
            }
          });
        };
        listFiles(modelDir);
      }
    }
    
  } catch (error) {
    console.error('\n[Error] 下载失败:', error.message);
    process.exit(1);
  }
}

main();
