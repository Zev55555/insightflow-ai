# AI 数据分析业务流程助手

当前版本：v0.4.0

这是一个面向数据分析新手的 MVP Web 应用。它帮助用户把模糊的业务需求，转化成清晰的数据分析思路、指标体系、业务假设、分析路径、风险提醒和汇报大纲。

本工具不会生成 SQL、Python、pandas、Excel 公式、数据清洗代码或仪表盘。

## v0.4 更新

- 支持用户在网页内选择不同 AI 服务商
- 支持 OpenAI、DeepSeek、Claude、Gemini、OpenAI-Compatible 自定义接口
- 支持填写 API Key、API Base URL 和模型名称
- 继续保持 BYOK 模式：用户自带 API Key
- API Key 可选择仅本次会话保存，或保存到本地浏览器
- 后端只在本次生成请求中临时使用用户 API Key，不保存到数据库

## 开发方式说明

本项目是一个基于 **vibe coding** 工作流完成的 AI 产品原型。

项目从“帮助用户把模糊业务需求转化为清晰数据分析流程”这个产品想法出发，通过自然语言需求描述、界面反馈、Prompt 调整和功能迭代逐步完成。

在开发过程中，**OpenAI Codex** 主要用于辅助完成代码实现、页面重构、功能调试和部署准备。产品定位、业务分析框架、Prompt 设计、UI 方向和测试反馈由人工主导。

## 技术栈

- Next.js
- React
- Tailwind CSS
- Framer Motion
- Lucide React
- AI 服务商 API
- 可部署到 Vercel

## 本地安装

安装依赖：

```bash
npm install
```

当前版本是用户自带 API Key 的 BYOK 模式，通常不需要配置 `.env.local`。

请不要把真实 API Key 提交到 GitHub 或分享给别人。

## 本地运行

启动开发服务器：

```bash
npm run dev
```

本地打开：

```bash
http://localhost:3000
```

在线部署示例：

```bash
https://ai-data-analysis-assistant-six.vercel.app/
```

## 多模型 API 配置

本项目支持用户自定义 AI 服务商。当前支持：

- OpenAI
- DeepSeek
- Claude
- Gemini
- OpenAI-Compatible 自定义接口
- 其他 / 自定义

用户可以在右上角“设置”弹窗里填写：

- AI 服务商
- API Key
- API Base URL
- 模型名称
- 保存方式

API Key 保存方式：

- 仅本次会话保存：使用 `sessionStorage` 保存 `ai_provider`、`api_key`、`api_base_url`、`model`、`custom_model`
- 保存到本地浏览器：使用 `localStorage` 保存 `ai_provider`、`api_key`、`api_base_url`、`model`、`custom_model`

页面加载时会优先读取 `sessionStorage`，如果没有再读取 `localStorage`。

项目不会把用户 API Key 保存到数据库。后端只会在本次请求中临时使用用户传来的 API Key 调用所选 AI 服务商，不会保存、不返回、不打印完整 Key。

OpenAI-Compatible 模式适合支持 OpenAI API 格式的第三方平台，例如 OpenRouter、硅基流动、部分国产模型平台等。使用时请按照服务商文档填写 API Base URL 和模型名称。

如果第三方接口调用失败，请检查：

- API Base URL 是否正确
- 模型名称是否正确
- API Key 是否有效
- 账户额度是否充足
- 当前服务商是否真的兼容 OpenAI Chat Completions 格式

不建议在公共电脑上选择“保存到本地浏览器”。

## 各服务商调用方式

- OpenAI：按 OpenAI-compatible 的 Chat Completions 格式调用，默认 Base URL 为 `https://api.openai.com/v1`
- DeepSeek：按 OpenAI-compatible 的 Chat Completions 格式调用，默认 Base URL 为 `https://api.deepseek.com`
- Claude：按 Anthropic Messages API 格式调用
- Gemini：按 Google Gemini `generateContent` REST 格式调用
- OpenAI-Compatible：按用户填写的 Base URL 调用 `/chat/completions`
- 自定义：先按 OpenAI-compatible 格式尝试调用；如果失败，请检查接口文档

## 使用流程

1. 点击右上角“设置”，选择 AI 服务商。
2. 填写自己的 API Key、API Base URL 和模型名称。
3. 选择保存方式并点击“保存设置”。
4. 选择业务场景。
5. 选择常见业务问题，或填写自己的具体问题。
6. 手动补充已知信息，或上传 CSV 文件识别字段结构。
7. 点击生成分析流程，查看结构化结果卡片。

生成结果包括：

1. 业务问题重写
2. 指标体系设计
3. 分析维度拆解
4. 可能业务假设
5. 分析路径规划
6. 结论风险提醒
7. 汇报大纲

## 上传文件说明

当前版本只读取 CSV 的：

- 文件名
- 字段名列表
- 前 5 行样例

这些信息会被整理后传给后端 prompt，帮助 AI 生成更贴近数据结构的分析路径。

本工具不会把文件当作完整数据集来分析，也不会生成 SQL、Python、pandas 或 Excel 公式。

## 构建检查

```bash
npm run build
```

## 项目结构

```text
app/
  api/generate/route.js  后端接口：根据服务商调用不同 AI API，并要求 AI 返回结构化 JSON
  globals.css            全局样式和 Tailwind CSS 引入
  layout.js              页面基础结构、网页标题和描述
  page.js                四步向导、多服务商 API 设置弹窗、CSV 预览、结果卡片展示
.env.example             环境变量示例文件
package.json             项目依赖和运行命令
```

## 部署到 Vercel

1. 把项目推送到 GitHub。
2. 在 Vercel 中导入仓库。
3. 部署。

当前版本不需要在 Vercel 中配置统一的服务端 API Key。用户可以在网页设置中输入自己的 API Key 使用。
