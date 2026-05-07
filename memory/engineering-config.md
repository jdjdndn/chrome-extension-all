---
name: 工程化配置
description: Prettier、ESLint、Git Hooks配置模式
type: reference
---

# 工程化配置模式

## Prettier

**配置文件**: `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**命令**:

- `npm run format` — 格式化代码
- `npm run format:check` — 检查格式

## ESLint

**配置文件**: `.eslintrc.json`

**关键规则**:

- `no-unused-vars: warn` — 未使用变量警告
- `no-case-declarations: warn` — case中声明变量警告
- `no-empty: warn` — 空块语句警告

**命令**:

- `npm run lint` — 检查代码
- `npm run lint:fix` — 自动修复

**全局变量**:

- `chrome` — Chrome API
- `EventBus` — 事件总线
- `clients` — Service Worker clients

## Git Hooks

**依赖**: `simple-git-hooks` + `lint-staged`

**pre-commit**:

1. lint-staged格式化暂存文件
2. ESLint检查并自动修复
3. TypeScript类型检查

**跳过**: `git commit --no-verify`

## EditorConfig

**文件**: `.editorconfig`

统一编辑器配置：

- UTF-8编码
- 2空格缩进
- LF换行
- 自动插入最终换行

## How to apply

新项目复制以下文件：

- `.prettierrc`
- `.prettierignore`
- `.eslintrc.json`
- `.eslintignore`
- `.editorconfig`

添加npm依赖：

```bash
npm install --save-dev prettier eslint@^8 simple-git-hooks lint-staged
```
