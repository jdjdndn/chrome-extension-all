# 规则

## 中文为先

## 没有明说删除什么功能代码，都要以当前实现功能为基础，在基础上修改

## Agents

项目专用 AI Agents（`.claude/agents/`）：

| Agent                   | 描述                |
| ----------------------- | ------------------- |
| chrome-extension-expert | Chrome 扩展开发专家 |
| performance-optimizer   | 性能优化专家        |
| security-reviewer       | 安全审查专家        |
| code-reviewer           | 代码质量审查        |
| test-generator          | 测试生成            |
| refactor-advisor        | 重构顾问            |

## 自动触发

修改文件时自动分析并推荐 agent（`.claude/hooks/dispatcher.py`）：

- 文件路径匹配
- 代码内容分析
- 自动修复建议

## 调试工具

浏览器控制台：`.claude/scripts/devtools-debug.js`

- `quickDiagnose()` — 快速诊断
- `checkWorkers()` — Worker 状态
- `detectMemoryLeak()` — 内存泄漏检测
