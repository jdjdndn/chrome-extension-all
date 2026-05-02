/**
 * 资源加速器测试
 * 在浏览器控制台中运行此测试
 */

(function () {
  'use strict';

  const ResourceAcceleratorTest = {
    results: [],
    passed: 0,
    failed: 0,

    assert(condition, message) {
      this.results.push({
        pass: condition,
        message,
        timestamp: Date.now()
      });
      if (condition) {
        this.passed++;
        console.log(`✅ ${message}`);
      } else {
        this.failed++;
        console.log(`❌ ${message}`);
      }
    },

    async runAll() {
      console.log('========== 资源加速器测试 ==========');

      await this.testCDNMappings();
      await this.testJSReplacer();
      await this.testFontReplacer();
      await this.testImageOptimizer();
      await this.testResourceAccelerator();

      console.log('\n========== 测试结果 ==========');
      console.log(`通过: ${this.passed}`);
      console.log(`失败: ${this.failed}`);
      console.log(`总计: ${this.passed + this.failed}`);

      return {
        passed: this.passed,
        failed: this.failed,
        results: this.results
      };
    },

    async testCDNMappings() {
      console.log('\n--- CDNMappings 测试 ---');

      // 测试CDNMappings是否存在
      this.assert(
        typeof window.CDNMappings !== 'undefined',
        'CDNMappings模块已加载'
      );

      if (!window.CDNMappings) return;

      // 测试JS库匹配
      const jqueryResult = window.CDNMappings.matchJSLibrary(
        'https://code.jquery.com/jquery-3.7.1.min.js'
      );
      this.assert(
        jqueryResult && jqueryResult.name === 'jquery',
        'jQuery URL匹配正确'
      );
      this.assert(
        jqueryResult && jqueryResult.version === '3.7.1',
        'jQuery版本提取正确'
      );

      const reactResult = window.CDNMappings.matchJSLibrary(
        'https://unpkg.com/react@18.2.0/umd/react.production.min.js'
      );
      this.assert(
        reactResult && reactResult.name === 'react',
        'React URL匹配正确'
      );

      const vueResult = window.CDNMappings.matchJSLibrary(
        'https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.min.js'
      );
      this.assert(
        vueResult && vueResult.name === 'vue',
        'Vue URL匹配正确'
      );

      // 测试智能匹配 - 已知包名模式
      const smartMatch = window.CDNMappings.matchJSLibrary(
        'https://example.com/lodash@4.17.21/lodash.min.js'
      );
      this.assert(
        smartMatch && smartMatch.isAutoDetected === true,
        '智能匹配识别 lodash 包'
      );

      // 测试智能匹配 - scope 包名
      const scopeMatch = window.CDNMappings.matchJSLibrary(
        'https://cdn.example.com/@babel/core@7.24.0/dist/bundle.js'
      );
      this.assert(
        scopeMatch && scopeMatch.isAutoDetected === true,
        '智能匹配识别 @babel/core scope 包'
      );

      // 测试完全未知URL（无包名模式）
      const unknownResult = window.CDNMappings.matchJSLibrary(
        'https://example.com/custom-library.js'
      );
      this.assert(
        unknownResult === null || unknownResult.isAutoDetected,
        '未知URL返回null或自动检测结果'
      );

      // 测试异步匹配（jsDelivr API 查询）
      try {
        const asyncMatch = await window.CDNMappings.matchJSLibraryAsync(
          'https://example.com/ramda@0.29.0/ramda.min.js'
        );
        this.assert(
          asyncMatch !== null,
          '异步匹配 ramda 包成功'
        );
      } catch (e) {
        this.assert(false, `异步匹配异常: ${e.message}`);
      }

      // 测试字体匹配
      const fontResult = window.CDNMappings.matchFont(
        'https://fonts.googleapis.com/css2?family=Roboto'
      );
      this.assert(
        fontResult && fontResult.name === 'google-fonts',
        'Google Fonts URL匹配正确'
      );
      this.assert(
        fontResult && fontResult.cdnUrl.includes('fonts.font.im'),
        '字体镜像URL替换正确'
      );
    },

    async testJSReplacer() {
      console.log('\n--- JSReplacer 测试 ---');

      this.assert(
        typeof window.JSReplacer !== 'undefined',
        'JSReplacer模块已加载'
      );

      if (!window.JSReplacer) return;

      // 测试实例化
      const replacer = new window.JSReplacer({ enabled: true });
      this.assert(
        replacer.enabled === true,
        'JSReplacer初始化正确'
      );

      // 测试启用/禁用
      replacer.disable();
      this.assert(
        replacer.enabled === false,
        'JSReplacer禁用成功'
      );

      replacer.enable();
      this.assert(
        replacer.enabled === true,
        'JSReplacer启用成功'
      );

      // 测试统计
      const stats = replacer.getStats();
      this.assert(
        typeof stats === 'object' && 'replaced' in stats,
        'JSReplacer统计格式正确'
      );
    },

    async testFontReplacer() {
      console.log('\n--- FontReplacer 测试 ---');

      this.assert(
        typeof window.FontReplacer !== 'undefined',
        'FontReplacer模块已加载'
      );

      if (!window.FontReplacer) return;

      // 测试实例化
      const replacer = new window.FontReplacer({ enabled: true });
      this.assert(
        replacer.enabled === true,
        'FontReplacer初始化正确'
      );

      // 测试启用/禁用
      replacer.disable();
      this.assert(
        replacer.enabled === false,
        'FontReplacer禁用成功'
      );

      replacer.enable();
      this.assert(
        replacer.enabled === true,
        'FontReplacer启用成功'
      );
    },

    async testImageOptimizer() {
      console.log('\n--- ImageOptimizer 测试 ---');

      this.assert(
        typeof window.ImageOptimizer !== 'undefined',
        'ImageOptimizer模块已加载'
      );

      if (!window.ImageOptimizer) return;

      // 测试实例化
      const optimizer = new window.ImageOptimizer({
        lazyLoad: true,
        compress: true,
        compressQuality: 0.8
      });
      this.assert(
        optimizer.lazyLoadEnabled === true,
        'ImageOptimizer懒加载初始化正确'
      );
      this.assert(
        optimizer.compressEnabled === true,
        'ImageOptimizer压缩初始化正确'
      );
      this.assert(
        optimizer.compressQuality === 0.8,
        'ImageOptimizer压缩质量设置正确'
      );

      // 测试WebP支持检测
      const supportsWebP = optimizer.supportsWebP();
      this.assert(
        typeof supportsWebP === 'boolean',
        'WebP支持检测返回布尔值'
      );

      // 测试启用/禁用
      optimizer.disableLazyLoad();
      this.assert(
        optimizer.lazyLoadEnabled === false,
        '懒加载禁用成功'
      );

      optimizer.enableLazyLoad();
      this.assert(
        optimizer.lazyLoadEnabled === true,
        '懒加载启用成功'
      );
    },

    async testResourceAccelerator() {
      console.log('\n--- ResourceAccelerator 测试 ---');

      this.assert(
        typeof window.ResourceAccelerator !== 'undefined',
        'ResourceAccelerator模块已加载'
      );

      if (!window.ResourceAccelerator) return;

      // 测试实例化
      const accelerator = new window.ResourceAccelerator({
        enabled: true,
        jsReplace: true,
        fontReplace: true,
        imageLazyLoad: true,
        imageCompress: true
      });
      this.assert(
        accelerator.config.enabled === true,
        'ResourceAccelerator初始化正确'
      );

      // 测试配置更新
      accelerator.config.imageQuality = 0.9;
      this.assert(
        accelerator.config.imageQuality === 0.9,
        '配置更新成功'
      );

      // 测试性能优化配置
      this.assert(
        accelerator.config.maxPreloadHints === 10,
        '性能优化配置：maxPreloadHints 默认值正确'
      );
      this.assert(
        accelerator.config.maxCompressQueueSize === 50,
        '性能优化配置：maxCompressQueueSize 默认值正确'
      );
      this.assert(
        accelerator.config.mutationBatchInterval === 50,
        '性能优化配置：mutationBatchInterval 默认值正确'
      );
      this.assert(
        accelerator.config.enableBatchProcessing === true,
        '性能优化配置：enableBatchProcessing 默认值正确'
      );

      // v6: Third-party deferral config
      this.assert(
        typeof accelerator.config.thirdPartyDeferral === 'object',
        'thirdPartyDeferral config exists'
      );
      this.assert(
        Array.isArray(accelerator.config.thirdPartyDeferral.userRules),
        'userRules array exists'
      );

      // v6: Performance field
      this.assert(
        accelerator.performance === null || typeof accelerator.performance === 'object',
        'performance field exists'
      );
    }
  };

  // 导出到全局
  window.ResourceAcceleratorTest = ResourceAcceleratorTest;

  console.log('[ResourceAcceleratorTest] 测试模块已加载，运行 ResourceAcceleratorTest.runAll() 开始测试');
})();
