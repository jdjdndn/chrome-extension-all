import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 测试环境
    environment: 'jsdom',

    // 全局变量
    globals: true,

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.js',
        '**/*.config.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    },

    // 测试文件匹配
    include: ['tests/**/*.{test,spec}.{js,ts}'],

    // 排除文件
    exclude: ['node_modules', 'dist'],

    // 设置文件
    setupFiles: ['./tests/setup.ts'],

    // 超时配置
    testTimeout: 10000,
    hookTimeout: 10000,

    // 并行执行
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    },

    // 报告器
    reporters: ['default', 'html'],

    // 监听模式
    watch: false,

    // 更新快照
    update: false
  }
})
