/**
 * redirect-links 单元测试
 * 在浏览器控制台中运行此测试（需先加载 redirect-links.js）
 */

(function () {
  'use strict';

  const RedirectLinksTest = {
    results: [],
    passed: 0,
    failed: 0,

    assert(condition, message) {
      this.results.push({ pass: condition, message, timestamp: Date.now() });
      if (condition) {
        this.passed++;
        console.log(`✅ ${message}`);
      } else {
        this.failed++;
        console.log(`❌ ${message}`);
      }
    },

    async runAll() {
      console.log('========== redirect-links 测试 ==========');

      this.testConfigExists();
      this.testExtractUrlFromString();
      this.testDecodeUrlValue();
      this.testExtractTargetUrl();
      this.testLinkPatterns();
      this.testSkipDomains();

      console.log('\n========== 测试结果 ==========');
      console.log(`通过: ${this.passed}`);
      console.log(`失败: ${this.failed}`);
      console.log(`总计: ${this.passed + this.failed}`);

      return { passed: this.passed, failed: this.failed, results: this.results };
    },

    testConfigExists() {
      console.log('\n--- 配置测试 ---');
      this.assert(
        typeof REDIRECT_LINKS_CONFIG !== 'undefined',
        'REDIRECT_LINKS_CONFIG 已定义'
      );
      if (typeof REDIRECT_LINKS_CONFIG === 'undefined') return;

      this.assert(
        Array.isArray(REDIRECT_LINKS_CONFIG.LINK_PATTERNS),
        'LINK_PATTERNS 是数组'
      );
      this.assert(
        Array.isArray(REDIRECT_LINKS_CONFIG.TARGET_PARAMS),
        'TARGET_PARAMS 是数组'
      );
      this.assert(
        REDIRECT_LINKS_CONFIG.TARGET_PARAMS.includes('target'),
        'TARGET_PARAMS 包含 target'
      );
      this.assert(
        REDIRECT_LINKS_CONFIG.TARGET_PARAMS.includes('dest'),
        'TARGET_PARAMS 包含 dest（新增）'
      );
      this.assert(
        Array.isArray(REDIRECT_LINKS_CONFIG.SKIP_DOMAINS),
        'SKIP_DOMAINS 是数组'
      );

      this.assert(
        typeof window.RedirectLinksUtils !== 'undefined',
        'RedirectLinksUtils 已导出'
      );
    },

    testExtractUrlFromString() {
      console.log('\n--- extractUrlFromString 测试 ---');

      if (!window.RedirectLinksUtils) {
        this.assert(false, 'RedirectLinksUtils 不可用，跳过');
        return;
      }

      const { extractUrlFromString } = window.RedirectLinksUtils;

      const testCases = [
        { input: 'https://example.com/path', expected: 'https://example.com/path' },
        { input: 'http://example.com/path', expected: 'http://example.com/path' },
        { input: '//example.com/path', expected: '//example.com/path' },
        { input: 'https%3A//example.com/path', expected: '//example.com/path' },
        { input: 'example.com', expected: 'https://example.com' },
        { input: 'example.com:8080/path', expected: 'https://example.com:8080/path' },
        { input: 'not-a-url', expected: null },
        { input: '', expected: null },
      ];

      testCases.forEach((tc, i) => {
        const result = extractUrlFromString(tc.input);
        this.assert(
          result === tc.expected,
          `extractUrlFromString [${i + 1}] "${tc.input}" -> 期望 ${tc.expected}, 实际 ${result}`
        );
      });
    },

    testDecodeUrlValue() {
      console.log('\n--- decodeUrlValue 测试 ---');

      if (!window.RedirectLinksUtils) {
        this.assert(false, 'RedirectLinksUtils 不可用，跳过');
        return;
      }

      const { decodeUrlValue } = window.RedirectLinksUtils;

      const testCases = [
        { input: 'https%3A//example.com', expected: 'https://example.com' },
        { input: 'https%253A%252F%252Fexample.com', expected: 'https://example.com' },
        { input: 'https%3A%2F%2Fexample.com%3Fkey%3Dvalue', expected: 'https://example.com?key=value' },
        { input: 'https://example.com', expected: 'https://example.com' },
        { input: 'https%3A%2F%2Fexample.com%2Fpath%3Fa%3D1%26b%3D2', expected: 'https://example.com/path?a=1&b=2' },
      ];

      testCases.forEach((tc, i) => {
        const result = decodeUrlValue(tc.input);
        this.assert(
          result === tc.expected,
          `decodeUrlValue [${i + 1}] -> 期望 ${tc.expected}, 实际 ${result}`
        );
      });
    },

    testExtractTargetUrl() {
      console.log('\n--- extractTargetUrl 测试 ---');

      if (!window.RedirectLinksUtils) {
        this.assert(false, 'RedirectLinksUtils 不可用，跳过');
        return;
      }

      const { extractTargetUrl } = window.RedirectLinksUtils;

      const testCases = [
        // 标准 target 参数
        { input: 'https://link.zhihu.com/?target=https://example.com', expected: 'https://example.com' },
        // url 参数
        { input: 'https://example.com/redirect?url=https://target.com', expected: 'https://target.com' },
        // to 参数
        { input: 'https://example.com/go?to=https://target.com', expected: 'https://target.com' },
        // 新增 dest 参数
        { input: 'https://example.com/go?dest=https://dest.com', expected: 'https://dest.com' },
        // 新增 out 参数
        { input: 'https://example.com/go?out=https://out.com', expected: 'https://out.com' },
        // 新增 return 参数
        { input: 'https://example.com/go?return=https://return.com', expected: 'https://return.com' },
        // 新增 back 参数
        { input: 'https://example.com/go?back=https://back.com', expected: 'https://back.com' },
        // 嵌套编码
        { input: 'https://example.com/go?target=https%3A%2F%2Ftarget.com', expected: 'https://target.com' },
        // hash 中的参数
        { input: 'https://example.com/page#target=https://hash-target.com', expected: 'https://hash-target.com' },
        // 无效 URL
        { input: 'not-a-url', expected: null },
        // 空值
        { input: '', expected: null },
        // null
        { input: null, expected: null },
        // 无目标参数
        { input: 'https://example.com/page', expected: null },
        // 空参数值
        { input: 'https://example.com/go?target=', expected: null },
      ];

      testCases.forEach((tc, i) => {
        const result = extractTargetUrl(tc.input);
        const display = tc.input ? tc.input.substring(0, 50) : 'null';
        this.assert(
          result === tc.expected,
          `extractTargetUrl [${i + 1}] "${display}" -> 期望 ${tc.expected}, 实际 ${result}`
        );
      });
    },

    testLinkPatterns() {
      console.log('\n--- LINK_PATTERNS 测试 ---');

      if (typeof REDIRECT_LINKS_CONFIG === 'undefined') return;

      const patterns = REDIRECT_LINKS_CONFIG.LINK_PATTERNS;
      this.assert(patterns.length >= 9, `LINK_PATTERNS 包含至少 9 个模式（实际 ${patterns.length}）`);

      const stringPatterns = patterns.filter(p => typeof p === 'string');
      this.assert(stringPatterns.length >= 5, `包含至少 5 个字符串模式（实际 ${stringPatterns.length}）`);

      const regexPatterns = patterns.filter(p => p instanceof RegExp);
      this.assert(regexPatterns.length >= 3, `包含至少 3 个正则模式（实际 ${regexPatterns.length}）`);

      // 知乎正则
      const zhihuRegex = regexPatterns.find(r => r.source.includes('zhihu'));
      if (zhihuRegex) {
        this.assert(
          zhihuRegex.test('https://zhihu.com/question/123/answer/456'),
          '知乎答案链接正则匹配'
        );
        this.assert(
          !zhihuRegex.test('https://zhihu.com/hot'),
          '知乎热榜链接不匹配'
        );
      }

      // 抖音正则
      const douyinRegex = regexPatterns.find(r => r.source.includes('douyin'));
      if (douyinRegex) {
        this.assert(
          douyinRegex.test('https://douyin.com/user/123456'),
          '抖音用户链接正则匹配'
        );
      }

      // B站正则
      const biliRegex = regexPatterns.find(r => r.source.includes('bilibili'));
      if (biliRegex) {
        this.assert(
          biliRegex.test('https://www.bilibili.com/video/BV1xx411c7mD'),
          'B站视频链接正则匹配'
        );
        this.assert(
          !biliRegex.test('https://www.bilibili.com/anime/'),
          'B站动画页面不匹配'
        );
      }

      // 小红书正则
      const xhsRegex = regexPatterns.find(r => r.source.includes('xhslink'));
      if (xhsRegex) {
        this.assert(
          xhsRegex.test('https://xhslink.com/a/abc123'),
          '小红书短链接正则匹配'
        );
      }

      // 微博字符串模式
      this.assert(
        patterns.includes('weibo.com/n/'),
        '包含微博字符串模式'
      );

      // 百度贴吧字符串模式
      this.assert(
        patterns.includes('tieba.baidu.com/p/'),
        '包含百度贴吧字符串模式'
      );
    },

    testSkipDomains() {
      console.log('\n--- SKIP_DOMAINS 测试 ---');

      if (typeof REDIRECT_LINKS_CONFIG === 'undefined') return;

      const skipDomains = REDIRECT_LINKS_CONFIG.SKIP_DOMAINS;
      this.assert(skipDomains.includes('github.com'), 'SKIP_DOMAINS 包含 github.com');
      this.assert(skipDomains.includes('google.com'), 'SKIP_DOMAINS 包含 google.com');
      this.assert(skipDomains.length >= 3, `SKIP_DOMAINS 包含至少 3 个域名（实际 ${skipDomains.length}）`);
    }
  };

  window.RedirectLinksTest = RedirectLinksTest;

  console.log('[测试] redirect-links 测试模块已加载，调用 RedirectLinksTest.runAll() 运行');
})();
