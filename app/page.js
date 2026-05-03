"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Bus,
  Check,
  Copy,
  FileText,
  Gamepad2,
  GraduationCap,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MessageCircle,
  PanelsTopLeft,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const steps = ["选择业务场景", "选择或填写业务问题", "补充信息 / 上传数据", "生成分析流程"];

const API_KEY_STORAGE_KEY = "openai_api_key";
const MODEL_STORAGE_KEY = "openai_model";
const DEFAULT_MODEL = "gpt-4.1-mini";
const MODEL_OPTIONS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-4.1", "gpt-4.1-mini", "custom"];

const scenarioOptions = [
  {
    id: "ecommerce",
    title: "电商平台",
    description: "转化率、复购、优惠券、GMV、用户留存",
    icon: ShoppingBag,
    templates: [
      "新用户留存下降",
      "首单转化率下降",
      "优惠券核销率下降",
      "GMV 增长变慢",
      "复购率下降",
      "某个渠道投放效果变差",
      "活动效果不如预期",
    ],
  },
  {
    id: "game",
    title: "游戏",
    description: "活跃、留存、付费率、关卡流失、活动效果",
    icon: Gamepad2,
    templates: ["次日留存下降", "付费率下降", "新手关卡流失严重", "活动参与率低", "老用户流失增加"],
  },
  {
    id: "content",
    title: "内容社区",
    description: "DAU、观看时长、互动率、推荐点击率、内容消费",
    icon: MessageCircle,
    templates: ["DAU 下降", "用户观看时长下降", "推荐点击率下降", "内容互动率下降", "新用户激活率低"],
  },
  {
    id: "recruiting",
    title: "招聘平台",
    description: "投递率、沟通率、面试率、职位匹配、候选人质量",
    icon: BriefcaseBusiness,
    templates: ["简历投递率下降", "HR 沟通率下降", "面试转化率下降", "岗位匹配质量下降", "候选人质量不稳定"],
  },
  {
    id: "education",
    title: "教育产品",
    description: "完课率、续费率、学习活跃、课程转化",
    icon: GraduationCap,
    templates: ["课程完课率下降", "续费率下降", "试听到正课转化下降", "学习活跃度下降", "新课程转化不如预期"],
  },
  {
    id: "finance",
    title: "金融风控",
    description: "逾期率、通过率、坏账率、风险分层",
    icon: ShieldCheck,
    templates: ["逾期率上升", "审批通过率下降", "坏账率升高", "风险模型分层效果变差", "新客风险表现不稳定"],
  },
  {
    id: "saas",
    title: "SaaS 产品",
    description: "激活率、留存率、功能使用、续费率、流失原因",
    icon: PanelsTopLeft,
    templates: ["新用户激活率下降", "功能使用率低", "客户续费率下降", "试用转付费变差", "老客户流失增加"],
  },
  {
    id: "campus",
    title: "校园服务",
    description: "班车、食堂、图书馆、校园活动、服务供给",
    icon: Bus,
    templates: ["班车使用率下降", "食堂满意度下降", "图书馆预约利用率低", "校园活动参与率低", "服务供给和需求不匹配"],
  },
  {
    id: "other",
    title: "其他",
    description: "自定义业务场景",
    icon: Sparkles,
    templates: ["核心指标出现异常", "用户增长变慢", "转化效果不如预期", "用户流失增加", "新策略是否值得上线"],
  },
];

const sectionVariants = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(4px)" },
};

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell)) rows.push(row);
  return rows;
}

function maskApiKey(apiKey) {
  const trimmed = String(apiKey || "").trim();
  if (!trimmed) return "";
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}-****${suffix}`;
}

function resolveModel(modelChoice, customModel) {
  if (modelChoice === "custom") return customModel.trim();
  return modelChoice || DEFAULT_MODEL;
}

function StepIndicator({ currentStep, onStepSelect }) {
  return (
    <div className="glass-panel step-panel p-4 sm:p-5">
      <div className="relative z-10">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-500 to-fuchsia-300 shadow-[0_0_28px_rgba(139,92,246,0.38)]"
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isDone = index < currentStep;

            return (
              <button
                key={step}
                type="button"
                onClick={() => {
                  if (index <= currentStep) {
                    onStepSelect(index);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className={`rounded-[24px] border px-4 py-3 text-left transition duration-150 ease-out ${
                  isActive
                    ? "border-violet-300/65 bg-violet-300/12 text-white shadow-[0_0_34px_rgba(139,92,246,0.18)]"
                    : isDone
                      ? "border-white/15 bg-white/10 text-slate-200 hover:bg-white/14"
                      : "border-white/10 bg-white/[0.04] text-slate-500"
                }`}
              >
                <span className="block text-xs font-semibold">第 {index + 1} 步</span>
                <span className="mt-1 block text-sm font-semibold">{step}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActionBar({ children }) {
  return <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">{children}</div>;
}

function PrimaryButton({ children, disabled, onClick, type = "button", loading = false }) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      className="pill-primary inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </motion.button>
  );
}

function SecondaryButton({ children, onClick, icon: Icon }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      className="pill-secondary inline-flex min-h-12 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/16"
    >
      {Icon ? <Icon className={`h-4 w-4 ${Icon === Loader2 ? "animate-spin" : ""}`} /> : null}
      {children}
    </motion.button>
  );
}

function Notice({ type = "warning", children }) {
  const style =
    type === "error"
      ? "border-rose-300/30 bg-rose-400/12 text-rose-100"
      : "border-amber-300/30 bg-amber-300/12 text-amber-100";

  return (
    <div className={`glass-card mb-5 px-5 py-4 text-sm leading-6 ${style}`}>
      <div className="relative z-10 flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{children}</span>
      </div>
    </div>
  );
}

function SettingsModal({
  open,
  apiKey,
  setApiKey,
  modelChoice,
  setModelChoice,
  customModel,
  setCustomModel,
  saveTarget,
  setSaveTarget,
  showApiKey,
  setShowApiKey,
  status,
  onClose,
  onSave,
  onClear,
}) {
  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label="API 设置"
    >
      <motion.div
        className="glass-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6 sm:p-8"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200/18 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-100">
                <KeyRound className="h-3.5 w-3.5" />
                OpenAI
              </div>
              <h2 className="text-2xl font-bold text-white">API 设置</h2>
              <p className="mt-2 text-sm leading-7 text-[rgba(255,255,255,0.68)]">
                配置你的 OpenAI API Key 后，即可使用自己的额度生成业务分析流程。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/8 p-2 text-slate-200 transition duration-150 hover:border-violet-200/40 hover:bg-white/14"
              aria-label="关闭设置"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-100">API 服务商</span>
              <input value="OpenAI" readOnly className="glass-input min-h-12 w-full px-4 py-3 text-sm text-slate-200" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-100">API Key</span>
              <div className="relative">
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  type={showApiKey ? "text" : "password"}
                  placeholder="请输入你的 OpenAI API Key"
                  className="glass-input min-h-12 w-full px-4 py-3 pr-12 text-sm"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-300 transition duration-150 hover:bg-white/10 hover:text-white"
                  aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {apiKey ? <p className="mt-2 text-xs text-slate-400">当前显示：{maskApiKey(apiKey)}</p> : null}
            </label>

            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-100">模型名称</span>
              <select
                value={modelChoice}
                onChange={(event) => setModelChoice(event.target.value)}
                className="glass-input min-h-12 w-full px-4 py-3 text-sm"
              >
                <option value="gpt-5.5">gpt-5.5</option>
                <option value="gpt-5.4">gpt-5.4</option>
                <option value="gpt-5.4-mini">gpt-5.4-mini</option>
                <option value="gpt-4.1">gpt-4.1</option>
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                <option value="custom">自定义模型</option>
              </select>
              {modelChoice === "custom" ? (
                <input
                  value={customModel}
                  onChange={(event) => setCustomModel(event.target.value)}
                  placeholder="请输入模型名称"
                  className="glass-input mt-3 min-h-12 w-full px-4 py-3 text-sm"
                />
              ) : null}
            </div>

            <div>
              <span className="mb-3 block text-sm font-semibold text-slate-100">保存方式</span>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    id: "session",
                    title: "仅本次会话保存",
                    description: "刷新或关闭页面后可能失效。",
                  },
                  {
                    id: "local",
                    title: "保存到本地浏览器",
                    description: "API Key 会保存在当前设备浏览器中。",
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSaveTarget(option.id)}
                    className={`rounded-[22px] border p-4 text-left transition duration-150 ease-out ${
                      saveTarget === option.id
                        ? "border-violet-300/65 bg-violet-300/12 text-white"
                        : "border-white/10 bg-white/[0.06] text-slate-300 hover:border-violet-200/40 hover:bg-white/10"
                    }`}
                  >
                    <span className="block text-sm font-bold">{option.title}</span>
                    <span className="mt-2 block text-xs leading-5 text-[rgba(255,255,255,0.58)]">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {status?.message ? (
              <div
                className={`rounded-[24px] border px-4 py-3 text-sm leading-6 ${
                  status.type === "success"
                    ? "border-violet-200/24 bg-violet-300/12 text-violet-50"
                    : "border-rose-200/24 bg-rose-300/12 text-rose-50"
                }`}
              >
                {status.message}
              </div>
            ) : null}

            <div className="rounded-[24px] border border-violet-200/14 bg-violet-300/[0.08] px-4 py-4 text-sm leading-7 text-[rgba(255,255,255,0.72)]">
              你的 API Key 只用于向 OpenAI 发起本次分析请求。本工具不会把 API Key 保存到数据库，也不会在页面或日志中展示完整 Key。若选择“保存到本地浏览器”，Key 会保存在当前设备的浏览器存储中，请不要在公共电脑上保存。
              <br />
              建议使用单独创建的 Project API Key，并设置合理预算和权限。
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton onClick={onSave}>保存设置</PrimaryButton>
            <SecondaryButton onClick={onClear} icon={Trash2}>
              清除配置
            </SecondaryButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StepHeader({ eyebrow, title, description }) {
  return (
    <div className="relative z-10 mb-7">
      <p className="text-sm font-semibold text-violet-200/90">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{description}</p> : null}
    </div>
  );
}

function ResultSectionCard({ section, index }) {
  const groups = Array.isArray(section.groups) ? section.groups : [];
  const items = Array.isArray(section.items) ? section.items : [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.045, duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card p-5 sm:p-6"
    >
      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/12 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
            {index + 1}
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-bold tracking-tight text-white">{section.title}</h3>
            {section.summary ? (
              <p className="mt-4 rounded-[22px] border border-violet-200/20 bg-violet-300/12 px-4 py-3 text-sm font-semibold leading-7 text-violet-50">
                {section.summary}
              </p>
            ) : null}
          </div>
        </div>

        {items.length ? (
          <ul className="mt-6 space-y-3 text-sm leading-8 text-slate-200">
            {items.map((item, itemIndex) => (
              <li key={`${section.title}-item-${itemIndex}`} className="flex gap-3">
                <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200 shadow-[0_0_12px_rgba(167,139,250,0.72)]" />
                <span className="whitespace-pre-line">{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {groups.length ? (
          <div className="mt-6 space-y-4">
            {groups.map((group, groupIndex) => (
              <div key={`${section.title}-group-${groupIndex}`} className="rounded-[24px] border border-white/12 bg-white/[0.07] p-4">
                <h4 className="text-sm font-bold text-slate-50">{group.name}</h4>
                <ul className="mt-3 space-y-3 text-sm leading-8 text-slate-200">
                  {(group.items || []).map((item, itemIndex) => (
                    <li key={`${group.name}-item-${itemIndex}`} className="flex gap-3">
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200 shadow-[0_0_10px_rgba(196,181,253,0.55)]" />
                      <span className="whitespace-pre-line">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {section.warning ? (
          <div className="mt-6 rounded-[24px] border border-amber-200/22 bg-amber-300/12 px-4 py-3 text-sm leading-7 text-amber-50">
            <span className="font-bold">提醒：</span>
            <span className="whitespace-pre-line">{section.warning}</span>
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [customScenario, setCustomScenario] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customRequest, setCustomRequest] = useState("");
  const [availableInformation, setAvailableInformation] = useState("");
  const [fileSummary, setFileSummary] = useState(null);
  const [fileWarning, setFileWarning] = useState("");
  const [sections, setSections] = useState([]);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copyLabel, setCopyLabel] = useState("复制结果");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [modelChoice, setModelChoice] = useState(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState("");
  const [saveTarget, setSaveTarget] = useState("session");
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState(null);

  const scenarioName = useMemo(() => {
    if (!selectedScenario) return "";
    if (selectedScenario.id === "other") return customScenario.trim() || "其他业务场景";
    return selectedScenario.title;
  }, [customScenario, selectedScenario]);

  const businessRequest = useMemo(
    () => customRequest.trim() || selectedTemplate,
    [customRequest, selectedTemplate],
  );

  const canContinueFromStep2 = Boolean(scenarioName.trim() && businessRequest.trim());
  const canContinueFromStep3 = Boolean(availableInformation.trim() || fileSummary);
  const activeModel = resolveModel(modelChoice, customModel) || DEFAULT_MODEL;
  const hasConfiguredApi = Boolean(apiKey.trim());

  useEffect(() => {
    const sessionApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY) || "";
    const sessionModel = sessionStorage.getItem(MODEL_STORAGE_KEY) || "";
    const localApiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    const localModel = localStorage.getItem(MODEL_STORAGE_KEY) || "";

    const storedApiKey = sessionApiKey || localApiKey;
    const storedModel = sessionModel || localModel || DEFAULT_MODEL;

    if (storedApiKey) {
      setApiKey(storedApiKey);
      setSaveTarget(sessionApiKey ? "session" : "local");
    }

    if (MODEL_OPTIONS.includes(storedModel)) {
      setModelChoice(storedModel);
      setCustomModel("");
    } else {
      setModelChoice("custom");
      setCustomModel(storedModel);
    }
  }, []);

  function saveApiSettings() {
    const trimmedKey = apiKey.trim();
    const selectedModel = activeModel.trim() || DEFAULT_MODEL;

    if (!trimmedKey) {
      setSettingsStatus({ type: "error", message: "请先输入 API Key" });
      return;
    }

    if (!selectedModel) {
      setSettingsStatus({ type: "error", message: "请先选择或输入模型名称。" });
      return;
    }

    const targetStorage = saveTarget === "local" ? localStorage : sessionStorage;
    const otherStorage = saveTarget === "local" ? sessionStorage : localStorage;

    targetStorage.setItem(API_KEY_STORAGE_KEY, trimmedKey);
    targetStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    otherStorage.removeItem(API_KEY_STORAGE_KEY);
    otherStorage.removeItem(MODEL_STORAGE_KEY);

    setApiKey(trimmedKey);
    setSettingsStatus({ type: "success", message: "设置已保存" });
  }

  function clearApiSettings() {
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    sessionStorage.removeItem(MODEL_STORAGE_KEY);
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    localStorage.removeItem(MODEL_STORAGE_KEY);
    setApiKey("");
    setModelChoice(DEFAULT_MODEL);
    setCustomModel("");
    setSaveTarget("session");
    setSettingsStatus({ type: "success", message: "配置已清除。" });
  }

  function goBack() {
    setWarning("");
    setError("");
    setCurrentStep((step) => Math.max(0, step - 1));
  }

  function chooseScenario(scenario) {
    setSelectedScenario(scenario);
    setSelectedTemplate("");
    setCustomRequest("");
    setWarning("");
    setError("");
    setCurrentStep(1);
  }

  function continueFromStep2() {
    setWarning("");

    if (!scenarioName.trim()) {
      setWarning("请先补充具体业务场景。");
      return;
    }

    if (!businessRequest.trim()) {
      setWarning("请选择一个常见问题，或者输入你的具体业务问题。");
      return;
    }

    setCurrentStep(2);
  }

  function continueFromStep3() {
    setWarning("");

    if (!canContinueFromStep3) {
      setWarning("请先填写已知信息，或上传一个 CSV 文件用于识别字段结构。");
      return;
    }

    setCurrentStep(3);
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    setFileWarning("");
    setFileSummary(null);

    if (!file) return;

    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      setFileWarning("当前 v0.3 版本仅支持 CSV 文件。Excel 文件请先另存为 CSV 后再上传。");
      event.target.value = "";
      return;
    }

    if (!lowerName.endsWith(".csv")) {
      setFileWarning("请上传 .csv 文件。当前 v0.3 版本暂不解析其他格式。");
      event.target.value = "";
      return;
    }

    const text = await file.text();
    const rows = parseCsvRows(text).slice(0, 6);

    if (rows.length < 2) {
      setFileWarning("这个 CSV 没有识别到字段名和样例数据，请检查文件内容。");
      event.target.value = "";
      return;
    }

    const headers = rows[0].map((header, index) => header || `未命名字段${index + 1}`);
    const previewRows = rows.slice(1, 6).map((row) =>
      headers.reduce((record, header, index) => {
        record[header] = row[index] || "";
        return record;
      }, {}),
    );

    setFileSummary({
      fileName: file.name,
      headers,
      previewRows,
    });
  }

  async function generateWorkflow() {
    setError("");
    setWarning("");
    setCopyLabel("复制结果");

    if (!scenarioName.trim() || !businessRequest.trim() || !canContinueFromStep3) {
      setWarning("请先完成前面步骤，再生成分析流程。");
      return;
    }

    setIsLoading(true);
    setSections([]);
    setRawText("");

    try {
      const trimmedApiKey = apiKey.trim();
      const selectedModel = activeModel.trim() || DEFAULT_MODEL;
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: trimmedApiKey || undefined,
          model: selectedModel,
          businessScenario: scenarioName,
          businessRequest,
          availableInformation,
          fileSummary,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "missing_api_key" || data.code === "invalid_api_key" || data.code === "model_not_found") {
          setSettingsStatus({ type: "error", message: data.error || "请检查 API 设置。" });
          setSettingsOpen(true);
        }
        throw new Error(data.error || "生成失败，请稍后重试。");
      }

      setSections(Array.isArray(data.sections) ? data.sections : []);
      setRawText(data.rawText || "");
    } catch (requestError) {
      setError(requestError.message || "生成失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!sections.length && !rawText) return;

    const text =
      sections
        .map((section, index) => {
          const parts = [`${index + 1}. ${section.title}`];
          if (section.summary) parts.push(`重点：${section.summary}`);
          if (section.items?.length) parts.push(section.items.map((item) => `- ${item}`).join("\n"));
          if (section.groups?.length) {
            parts.push(
              section.groups
                .map((group) => {
                  const groupItems = (group.items || []).map((item) => `  - ${item}`).join("\n");
                  return `${group.name}\n${groupItems}`;
                })
                .join("\n"),
            );
          }
          if (section.warning) parts.push(`提醒：${section.warning}`);
          return parts.filter(Boolean).join("\n");
        })
        .join("\n\n") || rawText;

    await navigator.clipboard.writeText(text);
    setCopyLabel("已复制到剪贴板");
    window.setTimeout(() => setCopyLabel("复制结果"), 1600);
  }

  return (
    <main className="liquid-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto max-w-7xl"
      >
        <div className="hero-halo" aria-hidden="true" />
        <div className="hero-ring" aria-hidden="true" />

        <div className="mb-6 flex items-center justify-end gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-[rgba(255,255,255,0.62)] backdrop-blur-xl">
            {hasConfiguredApi ? "已配置 API" : "未配置 API"}
          </span>
          <button
            type="button"
            onClick={() => {
              setSettingsStatus(null);
              setSettingsOpen(true);
            }}
            className="pill-secondary inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-100"
          >
            <Settings className="h-4 w-4" />
            设置
          </button>
        </div>

        <header className="relative mb-14 pt-10 sm:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/18 bg-[#15102e]/55 px-4 py-2 text-sm font-semibold text-violet-100 shadow-lg backdrop-blur-2xl">
            <Sparkles className="h-4 w-4" />
            AI 数据分析流程生成器
          </div>
          <h1 className="mt-7 max-w-5xl text-4xl font-bold tracking-tight text-white drop-shadow-[0_0_28px_rgba(196,181,253,0.18)] sm:text-6xl">
            AI 数据分析业务流程助手
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[rgba(255,255,255,0.72)] sm:text-lg">
            把模糊的业务需求，转化成清晰的数据分析思路、指标体系和行动建议。
          </p>
        </header>

        <div className="mb-6">
          <StepIndicator
            currentStep={currentStep}
            onStepSelect={(step) => {
              setWarning("");
              setError("");
              setCurrentStep(step);
            }}
          />
        </div>

        {warning ? <Notice>{warning}</Notice> : null}
        {error ? <Notice type="error">{error}</Notice> : null}

        <section className="glass-panel content-panel p-6 sm:p-9 lg:p-12">
          <AnimatePresence mode="wait">
            {currentStep === 0 ? (
              <motion.div
                key="step-1"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10"
              >
                <StepHeader
                  eyebrow="第 1 步"
                  title="选择业务场景"
                  description="选择最接近的业务场景，系统会自动推荐常见分析问题。"
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {scenarioOptions.map((scenario) => {
                    const selected = selectedScenario?.id === scenario.id;
                    const Icon = scenario.icon;

                    return (
                      <motion.button
                        key={scenario.id}
                        type="button"
                        onClick={() => chooseScenario(scenario)}
                        whileHover={{ y: -2, scale: 1.012 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                        className={`glass-card min-h-40 p-5 text-left transition duration-150 ease-out ${
                          selected
                            ? "border-violet-300/75 shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_18px_60px_rgba(139,92,246,0.22)]"
                            : "hover:border-violet-200/45 hover:bg-white/12 hover:shadow-[0_18px_48px_rgba(139,92,246,0.16)]"
                        }`}
                      >
                        <div className="relative z-10">
                          <div className="mb-5 flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-violet-200/20 bg-violet-300/10 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                              <Icon className="h-6 w-6" />
                            </div>
                            {selected ? (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-300 text-slate-950">
                                <Check className="h-4 w-4" />
                              </div>
                            ) : null}
                          </div>
                          <h3 className="text-lg font-bold text-white">{scenario.title}</h3>
                          <p className="mt-3 text-sm leading-6 text-slate-300">{scenario.description}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}

            {currentStep === 1 ? (
              <motion.div
                key="step-2"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10"
              >
                <StepHeader
                  eyebrow="第 2 步"
                  title="选择或填写业务问题"
                  description={`当前场景：${selectedScenario?.title || "未选择"}`}
                />

                {selectedScenario?.id === "other" ? (
                  <label className="mb-6 block">
                    <span className="mb-3 block text-sm font-semibold text-slate-100">请补充具体业务场景</span>
                    <input
                      value={customScenario}
                      onChange={(event) => setCustomScenario(event.target.value)}
                      placeholder="例如：本地生活服务、医疗预约平台、线下零售门店"
                      className="glass-input min-h-14 w-full px-5 py-4 text-sm"
                    />
                  </label>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(selectedScenario?.templates || []).map((template) => {
                    const selected = selectedTemplate === template && !customRequest.trim();

                    return (
                      <motion.button
                        key={template}
                        type="button"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setCustomRequest("");
                          setWarning("");
                        }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                        className={`rounded-[22px] border px-4 py-4 text-left text-sm font-semibold transition ${
                          selected
                            ? "border-violet-300/70 bg-violet-300/14 text-violet-50 shadow-[0_0_26px_rgba(139,92,246,0.16)]"
                            : "border-white/12 bg-white/[0.07] text-slate-200 hover:border-violet-200/42 hover:bg-white/12"
                        }`}
                      >
                        {template}
                      </motion.button>
                    );
                  })}
                </div>

                <label className="mt-6 block">
                  <span className="mb-3 block text-sm font-semibold text-slate-100">或者输入你的具体业务问题</span>
                  <textarea
                    value={customRequest}
                    onChange={(event) => {
                      setCustomRequest(event.target.value);
                      setWarning("");
                    }}
                    placeholder="或者输入你的具体业务问题……"
                    className="glass-input min-h-32 w-full resize-y px-5 py-4 text-sm leading-7"
                  />
                </label>

                <ActionBar>
                  <SecondaryButton onClick={goBack} icon={ArrowLeft}>
                    返回上一步
                  </SecondaryButton>
                  <PrimaryButton onClick={continueFromStep2} disabled={!canContinueFromStep2}>
                    继续补充信息
                    <ArrowRight className="h-4 w-4" />
                  </PrimaryButton>
                </ActionBar>
              </motion.div>
            ) : null}

            {currentStep === 2 ? (
              <motion.div
                key="step-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10"
              >
                <StepHeader
                  eyebrow="第 3 步"
                  title="补充已知信息 / 上传数据文件"
                  description="上传文件只用于识别字段结构，帮助生成更准确的分析路径；本工具不会直接替你完成数据分析。"
                />

                <div className="rounded-[28px] border border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm font-semibold leading-6 text-amber-100">
                  当前 v0.3 版本仅支持 CSV 文件，Excel 请先另存为 CSV。
                </div>

                <label className="mt-6 block">
                  <span className="mb-3 block text-sm font-semibold text-slate-100">已知信息 / 可用字段 / 背景说明</span>
                  <textarea
                    value={availableInformation}
                    onChange={(event) => setAvailableInformation(event.target.value)}
                    placeholder="例如：有用户ID、注册时间、渠道来源、设备类型、次日是否活跃、7日是否活跃、首单转化情况等字段。"
                    className="glass-input min-h-40 w-full resize-y px-5 py-4 text-sm leading-7"
                  />
                </label>

                <div className="glass-card mt-6 p-5">
                  <div className="relative z-10">
                    <label className="block">
                      <span className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <UploadCloud className="h-4 w-4 text-violet-200" />
                        可选上传 CSV / Excel 文件
                      </span>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-white/14 file:px-5 file:py-3 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20"
                      />
                    </label>

                    {fileWarning ? (
                      <div className="mt-4 rounded-[24px] border border-amber-200/22 bg-amber-300/12 px-4 py-3 text-sm text-amber-50">
                        {fileWarning}
                      </div>
                    ) : null}

                    {fileSummary ? (
                      <div className="mt-6">
                        <p className="flex items-center gap-2 text-sm font-bold text-white">
                          <FileText className="h-4 w-4 text-violet-200" />
                          文件名：{fileSummary.fileName}
                        </p>
                        <div className="mt-5">
                          <p className="text-sm font-semibold text-slate-100">字段名列表</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {fileSummary.headers.map((header) => (
                              <span key={header} className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                                {header}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 overflow-x-auto rounded-[24px] border border-white/10 bg-black/12">
                          <table className="min-w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="border-b border-white/10 bg-white/8">
                                {fileSummary.headers.slice(0, 6).map((header) => (
                                  <th key={header} className="px-4 py-3 font-bold text-slate-100">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fileSummary.previewRows.map((row, rowIndex) => (
                                <tr key={`preview-${rowIndex}`} className="border-b border-white/6 last:border-0">
                                  {fileSummary.headers.slice(0, 6).map((header) => (
                                    <td key={`${rowIndex}-${header}`} className="max-w-44 truncate px-4 py-3 text-slate-300">
                                      {row[header] || "-"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {fileSummary.headers.length > 6 ? (
                          <p className="mt-3 text-xs text-slate-400">预览区仅展示前 6 个字段，完整字段名会传给 AI。</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <ActionBar>
                  <SecondaryButton onClick={goBack} icon={ArrowLeft}>
                    返回上一步
                  </SecondaryButton>
                  <PrimaryButton onClick={continueFromStep3} disabled={!canContinueFromStep3}>
                    进入生成页面
                    <ArrowRight className="h-4 w-4" />
                  </PrimaryButton>
                </ActionBar>
              </motion.div>
            ) : null}

            {currentStep === 3 ? (
              <motion.div
                key="step-4"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 mx-auto max-w-5xl"
              >
                <StepHeader eyebrow="第 4 步" title="生成并查看分析流程" description="确认输入后生成结构化分析报告。" />

                <div className="grid gap-3 rounded-[28px] border border-white/12 bg-white/[0.07] p-5 text-sm text-slate-300 sm:grid-cols-3">
                  <div>
                    <p className="font-bold text-white">业务场景</p>
                    <p className="mt-2 leading-6">{scenarioName}</p>
                  </div>
                  <div>
                    <p className="font-bold text-white">业务问题</p>
                    <p className="mt-2 leading-6">{businessRequest}</p>
                  </div>
                  <div>
                    <p className="font-bold text-white">已知信息</p>
                    <p className="mt-2 leading-6">{fileSummary ? `已识别 CSV：${fileSummary.fileName}` : "手动填写"}</p>
                  </div>
                </div>

                <ActionBar>
                  <SecondaryButton onClick={goBack} icon={ArrowLeft}>
                    返回上一步
                  </SecondaryButton>
                  <PrimaryButton onClick={generateWorkflow} disabled={isLoading} loading={isLoading}>
                    {isLoading ? "正在生成分析思路..." : "生成分析流程"}
                    {!isLoading ? <BarChart3 className="h-4 w-4" /> : null}
                  </PrimaryButton>
                  {sections.length ? (
                    <SecondaryButton onClick={copyResult} icon={copyLabel === "复制结果" ? Copy : Check}>
                      {copyLabel}
                    </SecondaryButton>
                  ) : null}
                </ActionBar>

                {isLoading ? (
                  <div className="glass-card mt-8 p-6">
                    <div className="relative z-10">
                      <div className="h-3 w-48 animate-pulse rounded-full bg-white/20" />
                      <div className="mt-5 space-y-3">
                        <div className="h-3 animate-pulse rounded-full bg-white/12" />
                        <div className="h-3 w-10/12 animate-pulse rounded-full bg-white/10" />
                        <div className="h-3 w-8/12 animate-pulse rounded-full bg-white/10" />
                      </div>
                    </div>
                  </div>
                ) : null}

                {sections.length ? (
                  <div className="mt-8 space-y-5">
                    {sections.map((section, index) => (
                      <ResultSectionCard key={`${section.title}-${index}`} section={section} index={index} />
                    ))}
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </motion.div>

      <AnimatePresence>
        {settingsOpen ? (
          <SettingsModal
            open={settingsOpen}
            apiKey={apiKey}
            setApiKey={setApiKey}
            modelChoice={modelChoice}
            setModelChoice={setModelChoice}
            customModel={customModel}
            setCustomModel={setCustomModel}
            saveTarget={saveTarget}
            setSaveTarget={setSaveTarget}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            status={settingsStatus}
            onClose={() => setSettingsOpen(false)}
            onSave={saveApiSettings}
            onClear={clearApiSettings}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}
