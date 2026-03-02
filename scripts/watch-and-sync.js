#!/usr/bin/env node
/**
 * 自动打包脚本 - 监控文件变化并同步到 dist 目录
 * 使用方法: node scripts/watch-and-sync.js
 *
 * 或者使用 npm 脚本: npm run watch
 */

const fs = require('fs');
const path = require('path');

// 源目录和目标目录映射
const SYNC_CONFIG = {
  // 单个文件映射
  files: [
    { src: 'manifest.json', dest: 'dist/manifest.json' },
    { src: 'background.js', dest: 'dist/background.js' },
    { src: 'content.js', dest: 'dist/content.js' },
    { src: 'inject.js', dest: 'dist/inject.js' },
    { src: 'popup.html', dest: 'dist/popup.html' },
    { src: 'popup.js', dest: 'dist/popup.js' },
    { src: 'newtab.html', dest: 'dist/newtab.html' },
    { src: 'newtab.js', dest: 'dist/newtab.js' },
    { src: 'styles.css', dest: 'dist/styles.css' },
    { src: 'rules.json', dest: 'dist/rules.json' },
    { src: 'welcome.html', dest: 'dist/welcome.html' },
  ],
  // 目录映射
  directories: [
    { src: 'devtools', dest: 'dist/devtools' },
    { src: 'content', dest: 'dist/content' },
    { src: 'icons', dest: 'dist/icons' },
    { src: 'shared', dest: 'dist/shared' },
    { src: 'src', dest: 'dist/src' },
    // scripts 目录不需要同步到 dist
  ],
  // 忽略的文件模式
  ignorePatterns: [
    /\.git$/,
    /node_modules$/,
    /\.md$/,
    /dist$/,
    /\.claude$/,
  ],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 确保目录存在
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 复制单个文件
function copyFile(src, dest, verbose = true) {
  try {
    ensureDir(dest);
    fs.copyFileSync(src, dest);
    if (verbose) {
      log('green', `✓ 已复制: ${path.basename(src)}`);
    }
    return true;
  } catch (error) {
    log('red', `✗ 复制失败: ${src} -> ${error.message}`);
    return false;
  }
}

// 复制目录
function copyDirectory(src, dest, verbose = true) {
  if (!fs.existsSync(src)) {
    if (verbose) {
      log('yellow', `⚠ 目录不存在: ${src}`);
    }
    return false;
  }

  ensureDir(dest);
  let count = 0;

  function copyRecursive(currentSrc, currentDest) {
    // 确保目标目录存在
    if (!fs.existsSync(currentDest)) {
      fs.mkdirSync(currentDest, { recursive: true });
    }

    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrc, entry.name);
      const destPath = path.join(currentDest, entry.name);

      // 检查是否应该忽略
      const shouldIgnore = SYNC_CONFIG.ignorePatterns.some(pattern =>
        pattern.test(entry.name)
      );

      if (shouldIgnore) continue;

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        copyRecursive(srcPath, destPath);
      } else {
        // 确保目标目录存在
        ensureDir(destPath);
        try {
          fs.copyFileSync(srcPath, destPath);
          count++;
        } catch (error) {
          // 忽略复制错误（如文件正在被写入）
        }
      }
    }
  }

  copyRecursive(src, dest);

  if (verbose && count > 0) {
    log('green', `✓ 已复制目录: ${path.basename(src)} (${count} 个文件)`);
  }
  return true;
}

// 初始同步
function initialSync() {
  log('cyan', '═══════════════════════════════════════');
  log('cyan', '       Chrome 扩展自动打包工具');
  log('cyan', '═══════════════════════════════════════');
  log('blue', '\n📁 初始同步中...\n');

  // 确保 dist 目录存在
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // 复制单个文件
  for (const file of SYNC_CONFIG.files) {
    if (fs.existsSync(file.src)) {
      copyFile(file.src, file.dest);
    }
  }

  // 复制目录
  for (const dir of SYNC_CONFIG.directories) {
    if (fs.existsSync(dir.src)) {
      copyDirectory(dir.src, dir.dest);
    }
  }

  log('blue', '\n✅ 初始同步完成!\n');
}

// 监控文件变化
function watchFiles() {
  log('cyan', '═══════════════════════════════════════');
  log('yellow', '👀 正在监控文件变化... (按 Ctrl+C 停止)');
  log('cyan', '═══════════════════════════════════════\n');

  // 监控单个文件
  for (const file of SYNC_CONFIG.files) {
    if (fs.existsSync(file.src)) {
      fs.watch(file.src, (eventType) => {
        if (eventType === 'change') {
          const now = new Date().toLocaleTimeString();
          log('yellow', `[${now}] 📝 文件已修改: ${file.src}`);
          copyFile(file.src, file.dest);
        }
      });
    }
  }

  // 监控目录
  for (const dir of SYNC_CONFIG.directories) {
    if (fs.existsSync(dir.src)) {
      watchDirectory(dir.src, dir.dest);
    }
  }
}

// 递归监控目录
function watchDirectory(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;

  // 监控当前目录
  fs.watch(srcDir, (eventType, filename) => {
    if (!filename) return;

    const srcPath = path.join(srcDir, filename);
    const destPath = path.join(destDir, filename);

    // 检查是否应该忽略
    const shouldIgnore = SYNC_CONFIG.ignorePatterns.some(pattern =>
      pattern.test(filename)
    );

    if (shouldIgnore) return;

    const now = new Date().toLocaleTimeString();

    try {
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        // 新目录，复制并开始监控
        log('yellow', `[${now}] 📁 新目录: ${path.relative('.', srcPath)}`);
        copyDirectory(srcPath, destPath);
        watchDirectory(srcPath, destPath);
      } else {
        // 文件变化
        log('yellow', `[${now}] 📝 文件已修改: ${path.relative('.', srcPath)}`);
        copyFile(srcPath, destPath);
      }
    } catch (error) {
      // 文件可能被删除
      if (fs.existsSync(destPath)) {
        try {
          const destStat = fs.statSync(destPath);
          if (destStat.isDirectory()) {
            fs.rmSync(destPath, { recursive: true });
          } else {
            fs.unlinkSync(destPath);
          }
          log('red', `[${now}] 🗑️ 已删除: ${path.relative('.', destPath)}`);
        } catch (e) {
          // 忽略删除错误
        }
      }
    }
  });

  // 递归监控子目录
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !SYNC_CONFIG.ignorePatterns.some(p => p.test(entry.name))) {
      watchDirectory(
        path.join(srcDir, entry.name),
        path.join(destDir, entry.name)
      );
    }
  }
}

// 单次同步（不监控）
function singleSync() {
  initialSync();
  log('green', '🎉 同步完成! 退出...');
  process.exit(0);
}

// 主函数
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--once') || args.includes('-o')) {
    // 单次同步模式
    singleSync();
  } else {
    // 持续监控模式
    initialSync();
    watchFiles();
  }
}

// 运行
main();
