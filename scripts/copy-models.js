/**
 * 模型文件复制脚本
 * 
 * 功能：在构建时将模型文件复制到 .next/standalone 目录
 * 确保 Serverless 函数可以访问模型文件
 * 
 * 使用方法：
 * node scripts/copy-models.js
 */

const fs = require('fs');
const path = require('path');

// 源目录（预下载的模型）
const SOURCE_DIR = path.join(process.cwd(), 'public', 'models');

// 目标目录（standalone 输出目录）
const TARGET_DIR = path.join(process.cwd(), '.next', 'standalone', 'public', 'models');

/**
 * 递归复制目录
 */
function copyRecursive(src, dest) {
  // 如果源不存在，跳过
  if (!fs.existsSync(src)) {
    console.log(`[CopyModels] 源目录不存在: ${src}`);
    return;
  }

  // 获取源文件/目录信息
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    // 创建目标目录
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
      console.log(`[CopyModels] 创建目录: ${dest}`);
    }

    // 递归复制子目录
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(
        path.join(src, entry),
        path.join(dest, entry)
      );
    }
  } else {
    // 复制文件
    fs.copyFileSync(src, dest);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    console.log(`[CopyModels] 复制文件: ${path.basename(src)} (${sizeMB} MB)`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('========================================');
  console.log('  复制模型文件到 Standalone 目录');
  console.log('========================================');
  console.log(`[CopyModels] 源目录: ${SOURCE_DIR}`);
  console.log(`[CopyModels] 目标目录: ${TARGET_DIR}`);

  try {
    copyRecursive(SOURCE_DIR, TARGET_DIR);
    console.log('\n========================================');
    console.log('  模型文件复制完成！');
    console.log('========================================');
  } catch (error) {
    console.error('[CopyModels] 复制失败:', error.message);
    process.exit(1);
  }
}

main();
