const REQUIRED_SECTION_TITLES = [
  "业务问题重写",
  "指标体系设计",
  "分析维度拆解",
  "可能业务假设",
  "分析路径规划",
  "结论风险提醒",
  "汇报大纲",
];

const PROVIDER_DEFAULTS = {
  openai: {
    label: "OpenAI",
    type: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
  },
  deepseek: {
    label: "DeepSeek",
    type: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
  },
  claude: {
    label: "Claude",
    type: "claude",
    baseUrl: "https://api.anthropic.com",
  },
  gemini: {
    label: "Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  "openai-compatible": {
    label: "OpenAI-Compatible",
    type: "openai-compatible",
    baseUrl: "",
  },
  custom: {
    label: "自定义",
    type: "openai-compatible",
    baseUrl: "",
  },
};

const SYSTEM_INSTRUCTION = `你是一名资深数据分析师和业务分析教练。你的任务是帮助数据分析新手把模糊的业务需求转化为清晰、可执行的分析流程。你不是代码助手，不要写 SQL、Python、pandas、Excel 公式或任何数据清洗代码。你需要重点关注业务理解、指标体系、分析维度、业务假设、分析路径、结论风险和汇报结构。

回答必须使用简体中文，表达要具体、实用、贴近业务，不要空泛套话。你必须返回结构化 JSON，不要返回普通长文章，不要使用英文 section 标题。

非常重要的数据边界规则：
1. 必须严格区分：用户已经提供的数据字段、当前缺失但建议补充的数据字段、基于业务经验提出的可能分析方向。
2. 如果用户没有提供某个字段，不能把它当作已有字段来分析。业务场景、行业常识和常见指标模板都不能自动变成已有字段。
3. 如果分析某个问题需要额外字段，必须明确写：当前数据暂不支持这个判断，需要补充 xxx 字段。
4. 每个 section 都要尽量说明：已有数据可以支持什么、当前数据不能支持什么、建议补充哪些数据。
5. “指标体系设计”必须把指标分成两类：基于当前已有数据可以计算的指标、建议补充数据后才能计算的指标。
6. “可能业务假设”里每个假设都要标注：当前数据是否支持验证；如果不支持，需要补充什么字段。
7. 当用户提供的数据字段不足时，不要只说缺少哪些字段，还必须给出“补充数据优先级”。每个优先级都要说明：为什么优先级高、补上后能回答什么问题、不补会导致什么分析限制。
8. 不要为了让回答看起来完整而虚构数据字段。宁可说明当前数据不支持，也不要假装字段存在。

输出规则：
- 必须使用简体中文。
- 不要输出 SQL、Python、pandas、Excel 公式或任何代码。
- 不要使用英文标题。
- 不要把答案写成一整段长文章。
- 每一部分都要分点、分层、易读。
- 每一部分都要贴合用户输入的业务场景。
- 明确说明哪些结论可以被当前信息支持，哪些结论还需要进一步数据验证。
- 如果是指标异动问题，要先提醒检查数据产出、埋点、指标口径和统计范围。
- 如果是新策略是否上线的问题，要加入 A/B 实验思路，而不是直接建议全量上线。

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
            "指标1：基于哪些已有字段，为什么重要"
          ]
        },
        {
          "name": "建议补充数据后才能计算的指标",
          "items": [
            "第一优先级：字段A + 字段B。原因：...。能回答：...。不补限制：..."
          ]
        }
      ],
      "warning": "可选的风险提醒，没有则返回空字符串"
    }
  ]
}

最终 JSON 的 sections 数组必须正好包含这 7 个中文标题：业务问题重写、指标体系设计、分析维度拆解、可能业务假设、分析路径规划、结论风险提醒、汇报大纲。`;

class ProviderRequestError extends Error {
  constructor({ status = 500, code = "unknown_error", message = "生成失败，请稍后重试", provider = "", model = "", rawText = "" }) {
    super(message);
    this.status = status;
    this.code = code;
    this.provider = provider;
    this.model = model;
    this.rawText = rawText;
  }
}

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

如果分析需要某个缺失字段，请使用这类表达：
“当前数据暂不支持这个判断，需要补充 xxx 字段。”

请基于以上信息，生成一份结构化的业务分析流程，必须包含以下 7 个 section：
1. 业务问题重写
2. 指标体系设计
3. 分析维度拆解
4. 可能业务假设
5. 分析路径规划
6. 结论风险提醒
7. 汇报大纲`;
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
  return {
    title: String(section?.title || fallbackTitle).trim(),
    summary: String(section?.summary || "").trim(),
    items: toStringArray(section?.items),
    groups: normalizeGroups(section?.groups),
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

function redactSensitiveText(value) {
  return String(value || "").replace(/sk-[A-Za-z0-9_-]+/g, "sk-****").replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ****");
}

function safeJoinUrl(baseUrl, path) {
  const normalizedBase = String(baseUrl || "").trim().replace(/\/+$/, "");
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

function buildChatCompletionsUrl(baseUrl) {
  const normalizedBase = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (normalizedBase.endsWith("/chat/completions")) return normalizedBase;
  return safeJoinUrl(normalizedBase, "chat/completions");
}

function normalizeProviderConfig({ provider, apiKey, baseUrl, model }) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const providerConfig = PROVIDER_DEFAULTS[normalizedProvider];

  if (!normalizedProvider) {
    throw new ProviderRequestError({
      status: 400,
      code: "unsupported_provider",
      message: "请先选择 AI 服务商",
    });
  }

  if (!providerConfig) {
    throw new ProviderRequestError({
      status: 400,
      code: "unsupported_provider",
      message: "当前服务商暂不支持，请更换服务商或使用 OpenAI-Compatible 自定义接口",
      provider: normalizedProvider,
      model,
    });
  }

  const trimmedApiKey = String(apiKey || "").trim();
  const trimmedModel = String(model || "").trim();
  const finalBaseUrl = String(baseUrl || providerConfig.baseUrl || "").trim();

  if (!trimmedApiKey) {
    throw new ProviderRequestError({
      status: 400,
      code: "missing_api_key",
      message: "请先配置 API Key",
      provider: normalizedProvider,
      model: trimmedModel,
    });
  }

  if (!trimmedModel) {
    throw new ProviderRequestError({
      status: 400,
      code: "model_not_found",
      message: "请先填写模型名称",
      provider: normalizedProvider,
    });
  }

  if ((normalizedProvider === "openai-compatible" || normalizedProvider === "custom") && !finalBaseUrl) {
    throw new ProviderRequestError({
      status: 400,
      code: "missing_base_url",
      message: "请填写 API Base URL",
      provider: normalizedProvider,
      model: trimmedModel,
    });
  }

  return {
    provider: normalizedProvider,
    label: providerConfig.label,
    type: providerConfig.type,
    apiKey: trimmedApiKey,
    baseUrl: finalBaseUrl,
    model: trimmedModel,
  };
}

function mapProviderError(error, provider) {
  if (error instanceof ProviderRequestError && !error.rawText) return error;

  const status = error?.status || error?.response?.status || 500;
  const rawCode = String(error?.code || error?.error?.code || "").toLowerCase();
  const rawType = String(error?.type || error?.error?.type || "").toLowerCase();
  const rawText = String(error?.rawText || error?.message || "").toLowerCase();

  if (status === 401 || status === 403 || rawCode.includes("invalid_api_key") || rawType.includes("authentication")) {
    return new ProviderRequestError({
      status: 401,
      code: "invalid_api_key",
      message: "API Key 无效，请检查设置",
      provider,
      model: error?.model,
      rawText: error?.rawText,
    });
  }

  if (rawCode.includes("insufficient_quota") || rawText.includes("insufficient_quota") || rawText.includes("quota") || rawText.includes("billing")) {
    return new ProviderRequestError({
      status: 429,
      code: "insufficient_quota",
      message: "API 额度不足，请检查账户余额或用量限制",
      provider,
      model: error?.model,
      rawText: error?.rawText,
    });
  }

  if (status === 429 || rawCode.includes("rate_limit") || rawType.includes("rate_limit")) {
    return new ProviderRequestError({
      status: 429,
      code: "rate_limit",
      message: "请求过于频繁，请稍后重试",
      provider,
      model: error?.model,
      rawText: error?.rawText,
    });
  }

  if (
    status === 404 ||
    rawCode.includes("model_not_found") ||
    rawCode.includes("model_not_available") ||
    (rawText.includes("model") && (rawText.includes("not found") || rawText.includes("not exist") || rawText.includes("not supported")))
  ) {
    return new ProviderRequestError({
      status: 404,
      code: "model_not_found",
      message: "当前模型不可用，请检查模型名称",
      provider,
      model: error?.model,
      rawText: error?.rawText,
    });
  }

  if ((provider === "custom" || provider === "openai-compatible") && [400, 404, 405, 415].includes(status)) {
    return new ProviderRequestError({
      status: 400,
      code: "incompatible_api",
      message: "当前接口可能不兼容 OpenAI 格式，请检查 API Base URL、模型名称或服务商文档",
      provider,
      model: error?.model,
      rawText: error?.rawText,
    });
  }

  return new ProviderRequestError({
    status: 500,
    code: "unknown_error",
    message: "生成失败，请稍后重试",
    provider,
    model: error?.model,
    rawText: error?.rawText,
  });
}

async function readResponsePayload(response) {
  const text = await response.text();
  try {
    return {
      text,
      json: text ? JSON.parse(text) : null,
    };
  } catch {
    return {
      text,
      json: null,
    };
  }
}

function throwForFailedResponse(response, payload, config) {
  if (response.ok) return;

  const errorPayload = payload.json?.error || payload.json || {};
  throw new ProviderRequestError({
    status: response.status,
    code: errorPayload.code || errorPayload.status || "",
    message: errorPayload.message || response.statusText || "模型请求失败",
    provider: config.provider,
    model: config.model,
    rawText: payload.text,
  });
}

async function callOpenAICompatible(config, userPrompt) {
  const url = buildChatCompletionsUrl(config.baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  const payload = await readResponsePayload(response);
  throwForFailedResponse(response, payload, config);

  const text = payload.json?.choices?.[0]?.message?.content || payload.json?.choices?.[0]?.text || "";
  if (!text) {
    throw new ProviderRequestError({
      status: 500,
      code: "unknown_error",
      message: "模型没有返回可用内容",
      provider: config.provider,
      model: config.model,
      rawText: payload.text,
    });
  }

  return text;
}

async function callClaude(config, userPrompt) {
  const response = await fetch(safeJoinUrl(config.baseUrl, "v1/messages"), {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: SYSTEM_INSTRUCTION,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const payload = await readResponsePayload(response);
  throwForFailedResponse(response, payload, config);

  const text = (payload.json?.content || [])
    .map((part) => (part?.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw new ProviderRequestError({
      status: 500,
      code: "unknown_error",
      message: "模型没有返回可用内容",
      provider: config.provider,
      model: config.model,
      rawText: payload.text,
    });
  }

  return text;
}

async function callGemini(config, userPrompt) {
  const modelName = config.model.replace(/^models\//, "");
  const url = safeJoinUrl(config.baseUrl, `models/${encodeURIComponent(modelName)}:generateContent`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await readResponsePayload(response);
  throwForFailedResponse(response, payload, config);

  const text = (payload.json?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw new ProviderRequestError({
      status: 500,
      code: "unknown_error",
      message: "模型没有返回可用内容",
      provider: config.provider,
      model: config.model,
      rawText: payload.text,
    });
  }

  return text;
}

async function callModel(config, userPrompt) {
  if (config.type === "openai-compatible") {
    return callOpenAICompatible(config, userPrompt);
  }

  if (config.type === "claude") {
    return callClaude(config, userPrompt);
  }

  if (config.type === "gemini") {
    return callGemini(config, userPrompt);
  }

  throw new ProviderRequestError({
    status: 400,
    code: "unsupported_provider",
    message: "当前服务商暂不支持，请更换服务商或使用 OpenAI-Compatible 自定义接口",
    provider: config.provider,
    model: config.model,
  });
}

export async function POST(request) {
  let config = null;

  try {
    const body = await request.json().catch(() => ({}));
    const businessScenario = String(body.businessScenario || "").trim();
    const businessRequest = String(body.businessRequest || "").trim();
    const availableInformation = String(body.availableInformation || "").trim();
    const fileSummary = body.fileSummary || null;
    const hasKnownInformation =
      Boolean(availableInformation) ||
      Boolean(fileSummary && Array.isArray(fileSummary.headers) && fileSummary.headers.length);

    if (!businessScenario || !businessRequest || !hasKnownInformation) {
      return Response.json(
        {
          success: false,
          code: "missing_input",
          message: "请先填写完整的业务场景、业务问题和已知信息。",
        },
        { status: 400 },
      );
    }

    config = normalizeProviderConfig({
      provider: body.provider,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      model: body.model,
    });

    const rawText = await callModel(
      config,
      buildPrompt({
        businessScenario,
        businessRequest,
        availableInformation,
        fileSummary,
      }),
    );
    const sections = normalizeSections(rawText);

    return Response.json({
      success: true,
      result: {
        sections,
        rawText,
      },
      sections,
      rawText,
    });
  } catch (error) {
    const safeError = mapProviderError(error, config?.provider);

    console.error("AI provider request failed", {
      status: safeError.status,
      code: safeError.code,
      provider: safeError.provider,
      model: safeError.model,
      message: redactSensitiveText(safeError.message),
    });

    return Response.json(
      {
        success: false,
        code: safeError.code,
        message: safeError.message,
      },
      { status: safeError.status },
    );
  }
}
