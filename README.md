# AI 数据分析业务流程助手

当前版本：v0.3.0

这是一个面向数据分析新手的 MVP Web 应用。它帮助用户把模糊的业务需求，转化成清晰的数据分析思路、指标体系、业务假设、分析路径、风险提醒和汇报大纲。

本工具不会生成 SQL、Python、pandas、Excel 公式、数据清洗代码或仪表盘。

## v0.3 更新

- 支持用户在网页内配置自己的 OpenAI API Key
- 支持选择模型：`gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-4.1`、`gpt-4.1-mini` 或自定义模型
- 支持“仅本次会话保存”和“保存到本地浏览器”
- 后端支持用户 API Key 优先，`.env.local` 作为 fallback
- 不需要登录系统，不保存数据库

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
- OpenAI API
- 可部署到 Vercel

## 本地安装

安装依赖：

```bash
npm install
```

复制环境变量示例文件：

```bash
cp .env.example .env.local
```

Windows PowerShell 可以使用：

```powershell
Copy-Item .env.example .env.local
```

`.env.local` 是可选 fallback。你可以填入默认 API Key：

```bash
OPENAI_API_KEY=你的OpenAI密钥
OPENAI_MODEL=自定义
```

请不要把真实的 `.env.local` 提交到 GitHub 或分享给别人。

## 本地运行

启动开发服务器：

```bash
npm run dev
```

打开：

```bash
https://ai-data-analysis-assistant-six.vercel.app/
```

## 公开部署与用户自定义 API Key

这个版本可以公开部署给其他用户使用。用户打开网站后，点击右上角“设置”，输入自己的 OpenAI API Key 和模型名称即可使用。

用户可以选择两种保存方式：

- 仅本次会话保存：使用 `sessionStorage` 保存 `openai_api_key` 和 `openai_model`
- 保存到本地浏览器：使用 `localStorage` 保存 `openai_api_key` 和 `openai_model`

页面加载时会优先读取 `sessionStorage`，如果没有再读取 `localStorage`。

项目不会把用户 API Key 保存到数据库。后端只会在本次请求中临时使用用户传来的 API Key 调用 OpenAI，不会保存、不返回、不打印完整 Key。

实际生成分析流程时，后端会使用用户配置的 API Key 和模型名称调用 OpenAI。

开发者也可以使用 `.env.local` 配置默认 API Key，作为用户未配置 Key 时的 fallback。优先级是：

1. 用户设置里的 API Key
2. 服务端环境变量 `OPENAI_API_KEY`
3. 都没有则提示用户配置 API Key

模型优先级是：

1. 用户设置里的模型名称
2. 服务端环境变量 `OPENAI_MODEL`
3. 默认 `gpt-4.1-mini`

建议用户使用单独创建的 Project API Key，并设置合理预算和权限。不要在公共电脑上选择“保存到本地浏览器”。

如果生成失败，请检查 API Key、模型名称、账户额度或网络状态。


## 使用流程

1. 点击右上角“设置”，配置 API Key 和模型。
2. 选择业务场景。
3. 选择常见业务问题，或填写自己的具体问题。
4. 手动补充已知信息，或上传 CSV 文件识别字段结构。
5. 点击生成分析流程，查看结构化结果卡片。

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
  api/generate/route.js  后端接口：调用 OpenAI API，要求 AI 返回结构化 JSON
  globals.css            全局样式和 Tailwind CSS 引入
  layout.js              页面基础结构、网页标题和描述
  page.js                四步向导、API 设置弹窗、CSV 预览、结果卡片展示
.env.example             环境变量示例文件
package.json             项目依赖和运行命令
```

## 部署到 Vercel

1. 把项目推送到 GitHub。
2. 在 Vercel 中导入仓库。
3. 可选：在 Vercel 项目设置中添加环境变量：
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
4. 部署。

如果不配置服务端环境变量，用户仍然可以在网页设置中输入自己的 API Key 使用。
