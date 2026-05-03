import OpenAI from "openai";

const REQUIRED_SECTION_TITLES = [
  "业务问题重写",
  "指标体系设计",
  "分析维度拆解",
  "可能业务假设",
  "分析路径规划",
  "结论风险提醒",
  "汇报大纲",
];

const SYSTEM_INSTRUCTION = `你是一名资深数据分析师和业务分析教练。你的任务是帮助数据分析新手把模糊的业务需求转化为清晰、可执行的分析流程。你不是代码助手，不要写 SQL、Python、pandas、Excel 公式或任何数据清洗代码。你需要重点关注业务理解、指标体系、分析维度、业务假设、分析路径、结论风险和汇报结构。回答必须使用简体中文，表达要具体、实用、贴近业务，不要空泛套话。

你必须输出结构化 JSON，不能输出普通长文章。所有 section 标题必须使用简体中文。不要出现 Rewritten Business Question、Metric System、Risk Warnings 等英文标题。

非常重要的数据边界规则：
1. 你必须严格区分三类信息：
   - 用户已经提供的数据字段：只包括用户手动写出的字段、背景说明中明确提到的字段，以及上传 CSV 识别到的字段名。
   - 当前缺失但建议补充的数据字段：业务分析可能需要，但用户没有明确提供的字段。
   - 基于业务经验提出的可能分析方向：可以提出，但必须标注为“分析方向”或“待验证假设”，不能当作已有事实。
2. 如果用户没有提供某个字段，你不能把它当作已有字段来分析。业务场景、行业常识、常见指标模板，都不能自动变成已有字段。
3. 例如用户只写了“用户注册时间”，你不能直接假设有订单数据、优惠券数据、库存数据、渠道来源数据、留存数据或支付数据。
4. 如果某个判断需要额外字段，必须明确写：“当前数据暂不支持这个判断，需要补充 xxx 字段。”
5. 每个 section 都要尽量说明：已有数据可以支持什么、当前数据不能支持什么、建议补充哪些数据。
6. “指标体系设计”必须把指标分成两类：基于当前已有数据可以计算的指标、建议补充数据后才能计算的指标。
7. “可能业务假设”里的每个假设都必须标注：当前数据是否支持验证；如果不支持，需要补充什么字段。
8. 当用户提供的数据字段不足时，不要只说缺少哪些字段，还必须给出“补充数据优先级”。按优先级排序说明哪些字段最应该先补，并解释：为什么优先级高、补上后能回答什么问题、不补会导致什么分析限制。
9. 不要为了让回答看起来完整而虚构数据字段。宁可说“当前数据不支持”，也不要假装字段存在。`;

function stringifyFileSummary(fileSummary) {
  if (!fileSummary || !Array.isArray(fileSummary.headers)) {
    return "未上传数据文件。";
  }

  const headers = fileSummary.headers.join("、");
  const previewRows = Array.isArray(fileSummary.previewRows) ? fileSummary.previewRows : [];
  const samples = previewRows
    .slice(0, 5)
    .map((row, index) => {
      const cells = Object.entries(row)
        .slice(0, 8)
        .map(([key, value]) => `${key}=${String(value || "空")}`)
        .join("；");
      return `样例${index + 1}：${cells}`;
    })
    .join("\n");

  return `上传文件名：${fileSummary.fileName || "未命名 CSV"}
字段名：${headers}
前 5 行样例：
${samples || "没有可用样例"}`;
}

function buildPrompt({ businessScenario, businessRequest, availableInformation, fileSummary }) {
  return `业务场景 / 行业：
${businessScenario}

业务方提出的问题：
${businessRequest}

手动补充的已知信息 / 可用字段 / 背景说明：
${availableInformation || "用户没有手动补充。"}

上传文件识别到的字段结构和少量样例：
${stringifyFileSummary(fileSummary)}

请先严格判断“用户已经提供的数据字段”。只有以下信息可以算作已有数据：
- 用户手动补充内容里明确写出的字段或可用信息
- 上传 CSV 中识别到的字段名
- 前 5 行样例只能帮助理解字段含义，不能代表完整分析结论

以下信息不能被当作已有数据：
- 业务场景中的常见指标
- 你基于行业经验联想到的字段
- 为了分析方便而补充出来的字段
- 用户没有明确写出的订单、渠道、优惠券、库存、支付、留存、行为、曝光、点击、转化等字段

如果分析需要某个缺失字段，请用这类表达：
“当前数据暂不支持这个判断，需要补充 xxx 字段。”

如果当前数据字段不足，还必须在相关 section 里加入“补充数据优先级”。优先级写法要具体，例如：
- 第一优先级：用户ID + 注册时间 + 渠道来源
  原因：可以判断新用户下降是否来自渠道结构变化。
  能回答：哪个渠道下降最明显。
  不补限制：只能看到整体趋势，不能做来源归因。
- 第二优先级：注册漏斗字段
  原因：可以判断是流量减少还是注册转化变差。
  能回答：用户卡在哪个注册环节。
  不补限制：无法区分获客问题和产品流程问题。

请基于以上信息，生成一份结构化的业务分析流程，必须包含以下 7 个 section：

1. 业务问题重写
- 说明原始问题哪里模糊
- 改写成更清晰、可分析的问题
- 说明这个分析最终支持什么业务决策
- 明确说明当前已有数据能支持问题拆解到什么程度，哪些判断还缺字段

2. 指标体系设计
- 必须使用 groups 分组
- 分组必须包括：
  1. 基于当前已有数据可以计算的指标
  2. 建议补充数据后才能计算的指标
- 如果当前已有字段不足以计算关键指标，要直接说明不能计算，并写清楚缺什么字段
- 每个指标都要解释为什么重要，以及它能帮助判断或定位什么业务问题
- 不允许把用户没有提供的字段包装成“已有字段”
- 如果建议补充指标相关字段，必须按补充数据优先级排序，说明每一类字段的原因、能回答的问题和不补限制

3. 分析维度拆解
- 说明应该从哪些维度切入
- 只能把已有字段作为“当前可分析维度”
- 对缺失字段，只能放在“建议补充维度”或 warning 中
- 例如时间、渠道、用户、产品、地区、行为、运营策略等维度，只有在用户提供相关字段时才可以说当前可分析
- 如果关键维度字段缺失，要给出补充数据优先级，不要只列缺失字段

4. 可能业务假设
- 提出 3 到 6 个可验证的业务假设
- 每个假设都要说明：为什么合理、如何验证、如果成立意味着什么
- 每个假设必须标注：当前数据是否支持验证
- 如果不支持，必须写清楚需要补充什么字段
- 对多个缺失字段，要按补充数据优先级说明先补哪类字段最有助于验证假设
- 不要把业务经验假设写成已经发生的事实

5. 分析路径规划
- 给出清晰的分析顺序
- 第一步必须先盘点已有字段、缺失字段和数据口径风险
- 如果是指标异动问题，要先提醒检查数据产出、埋点、指标口径和统计范围
- 再进行维度拆解、假设验证和根因定位
- 如果是新策略是否上线的问题，要加入 A/B 实验思路，而不是直接建议全量上线
- 每一步都要说明依赖哪些已有字段，哪些步骤需要补充字段后才能做
- 如果字段不足，要把补充数据优先级作为分析路径的一部分，说明哪些字段应该先补、补完后先做什么分析

6. 结论风险提醒
- 说明哪些结论不能轻易下
- 必须结合当前已有字段，指出哪些结论当前数据暂不支持
- 提醒数据限制、样本量不足、口径变化、相关不等于因果、辛普森悖论、缺少关键数据等风险
- 对最影响结论可靠性的缺失字段，要给出补充数据优先级和不补限制
- 不要泛泛而谈

7. 汇报大纲
- 帮用户整理成可以汇报给业务方或老板的结构
- 包括背景、核心问题、已有数据范围、缺失数据、指标设计、分析路径、可能发现、风险说明和下一步建议
- 如果有缺失数据，要在汇报大纲中加入“补充数据优先级”部分
- 不要把缺失数据包装成已经完成的分析结果

输出规则：
- 必须使用简体中文
- 不要输出 SQL、Python、pandas、Excel 公式或任何代码
- 不要使用英文 section 标题
- 不要把答案写成一整段长文章
- 每一部分都要分点、分层、易读
- 每一部分都要贴合用户输入的业务场景
- 不要虚构数据字段
- 不要把“建议补充的数据字段”说成“当前已有字段”
- 字段不足时，必须给出补充数据优先级；每个优先级都要说明原因、能回答的问题和不补限制
- 如果上传文件只提供字段名和样例，只能据此推断分析路径，不能假装已经完成完整数据分析
- 明确说明哪些结论可以被当前信息支持，哪些结论还需要进一步数据验证

请只返回合法 JSON，不要包裹 Markdown 代码块。JSON 结构必须严格如下：
{
  "sections": [
    {
      "title": "业务问题重写",
      "summary": "一句话总结本部分重点",
      "items": [
        "已有数据可以支持：...",
        "当前数据不能支持：...",
        "建议补充数据：..."
      ],
      "warning": "可选的风险提醒，没有则返回空字符串"
    },
    {
      "title": "指标体系设计",
      "summary": "一句话总结本部分重点",
      "groups": [
        {
          "name": "基于当前已有数据可以计算的指标",
          "items": [
            "指标1：基于哪些已有字段，为什么重要",
            "如果没有足够字段，请写：当前已有数据不足以计算完整指标，只能做 xxx 初步判断"
          ]
        },
        {
          "name": "建议补充数据后才能计算的指标",
          "items": [
            "第一优先级：字段A + 字段B。原因：...。能回答：...。不补限制：...",
            "第二优先级：字段C。原因：...。能回答：...。不补限制：..."
          ]
        }
      ],
      "warning": "可选的风险提醒，没有则返回空字符串"
    }
  ]
}

最终 JSON 的 sections 数组必须正好包含这 7 个中文标题：
业务问题重写、指标体系设计、分析维度拆解、可能业务假设、分析路径规划、结论风险提醒、汇报大纲。`;
}

function extractJson(rawText) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return "";

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) return fencedMatch[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeGroups(groups) {
  if (!Array.isArray(groups)) return [];

  return groups
    .map((group) => ({
      name: String(group?.name || "").trim(),
      items: toStringArray(group?.items),
    }))
    .filter((group) => group.name || group.items.length);
}

function emptySection(title) {
  return {
    title,
    summary: "该部分暂未返回完整内容，请结合其他部分继续检查。",
    items: ["AI 返回格式不完整，系统已自动补齐该 section，避免页面崩溃。"],
    groups: [],
    warning: "请重新生成一次，或检查输入信息是否足够具体。",
  };
}

function normalizeSection(section, fallbackTitle) {
  const title = String(section?.title || fallbackTitle).trim();
  const groups = normalizeGroups(section?.groups);
  const items = toStringArray(section?.items);

  return {
    title,
    summary: String(section?.summary || "").trim(),
    items,
    groups,
    warning: String(section?.warning || "").trim(),
  };
}

function normalizeSections(rawText) {
  try {
    const parsed = JSON.parse(extractJson(rawText));
    const receivedSections = Array.isArray(parsed?.sections) ? parsed.sections : [];

    return REQUIRED_SECTION_TITLES.map((title) => {
      const matched = receivedSections.find((section) => section?.title === title);
      return matched ? normalizeSection(matched, title) : emptySection(title);
    });
  } catch {
    return REQUIRED_SECTION_TITLES.map((title, index) => {
      if (index === 4) {
        return {
          title,
          summary: "AI 返回内容不是标准 JSON，系统已把原始内容放在这里供你参考。",
          items: [String(rawText || "没有可用内容。")],
          groups: [],
          warning: "请检查本次返回是否包含代码、英文标题或不适合直接采用的结论。",
        };
      }

      return emptySection(title);
    });
  }
}

function getSafeOpenAIError(error) {
  const status = error?.status || error?.response?.status || 500;
  const rawCode = String(error?.code || error?.error?.code || "").toLowerCase();
  const rawMessage = String(error?.message || "").toLowerCase();

  if (status === 401 || status === 403 || rawCode.includes("invalid_api_key")) {
    return {
      status: 401,
      code: "invalid_api_key",
      error: "API Key 无效，请检查设置。",
    };
  }

  if (
    status === 404 ||
    rawCode.includes("model_not_found") ||
    rawCode.includes("model_not_available") ||
    (rawMessage.includes("model") && rawMessage.includes("not found"))
  ) {
    return {
      status: 404,
      code: "model_not_found",
      error: "当前模型不可用，请更换模型。",
    };
  }

  if (
    rawCode.includes("insufficient_quota") ||
    rawMessage.includes("insufficient_quota") ||
    rawMessage.includes("quota") ||
    rawMessage.includes("billing")
  ) {
    return {
      status: 429,
      code: "insufficient_quota",
      error: "API 额度不足，请检查账户余额或用量限制。",
    };
  }

  if (status === 429 || rawCode.includes("rate_limit")) {
    return {
      status: 429,
      code: "rate_limit",
      error: "请求过于频繁，请稍后再试。",
    };
  }

  return {
    status: 500,
    code: "unknown_error",
    error: "生成失败，请稍后重试。",
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const requestApiKey = String(body.apiKey || "").trim();
    const requestModel = String(body.model || "").trim();
    const businessScenario = String(body.businessScenario || "").trim();
    const businessRequest = String(body.businessRequest || "").trim();
    const availableInformation = String(body.availableInformation || "").trim();
    const fileSummary = body.fileSummary || null;
    const apiKey = requestApiKey || process.env.OPENAI_API_KEY || "";
    const model = requestModel || process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const hasKnownInformation =
      Boolean(availableInformation) ||
      Boolean(fileSummary && Array.isArray(fileSummary.headers) && fileSummary.headers.length);

    if (!businessScenario || !businessRequest || !hasKnownInformation) {
      return Response.json(
        { error: "请先填写完整的业务场景、业务问题和已知信息。" },
        { status: 400 },
      );
    }

    if (!apiKey) {
      return Response.json(
        { code: "missing_api_key", error: "请先配置 OpenAI API Key。" },
        { status: 400 },
      );
    }

    const client = new OpenAI({
      apiKey,
    });

    const response = await client.responses.create({
      model,
      instructions: SYSTEM_INSTRUCTION,
      input: buildPrompt({
        businessScenario,
        businessRequest,
        availableInformation,
        fileSummary,
      }),
    });

    const rawText = response.output_text || "";
    const sections = normalizeSections(rawText);

    return Response.json({
      sections,
      rawText,
    });
  } catch (error) {
    const safeError = getSafeOpenAIError(error);
    console.error("OpenAI request failed", {
      code: safeError.code,
      status: safeError.status,
    });
    return Response.json(
      { code: safeError.code, error: safeError.error },
      { status: safeError.status },
    );
  }
}
