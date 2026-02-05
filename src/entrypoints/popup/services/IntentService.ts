import { createLogger } from '../../../utils/logger';
import communicationService from './CommunicationService';

const logIntent = createLogger('intent');

/**
 * 前端意图识别服务
 * 因后端无法连接外网，意图识别在前端完成，调用 LLM API（需用户配置 API Key）
 */
export interface IntentResult {
  intent: 'troubleshoot' | 'query_status' | 'log_analysis' | 'system_health_check' | 'unknown';
  confidence: number;
  description: string;
  ai_analysis?: Record<string, unknown>;
}

export interface LLMConfig {
  apiKey: string;
  provider: 'moonshot' | 'openai' | 'siliconflow';
  baseURL?: string;
  model?: string;
}

export interface CombinedAnalysisResult {
  intentResult: IntentResult;
  entities: Record<string, unknown>;
  assistantReply?: string | null;
  ai_raw?: Record<string, unknown>;
}

const INTENTS = {
  troubleshoot: {
    keywords: ['排查', '故障', '异常', '问题', '检查', '分析', '诊断', '错误', '告警', '报警', '失败', '原因', '处理', '解决', '修复', '排除', '异常情况', '执行失败', '连接超时', '导航失败'],
    description: '故障排查请求',
    weight: 1.0
  },
  query_status: {
    keywords: ['状态', '查询', '查看', '检查', '运行情况', '运行状态', '执行状态', '整体状态', 'CPU使用率', '运行情况'],
    description: '状态查询',
    weight: 1.0
  },
  log_analysis: {
    keywords: ['日志', '分析', '下载', '查看', '检索', '获取', '错误日志', '最近日志', '相关日志', '日志检索'],
    description: '日志分析请求',
    weight: 1.0
  },
  system_health_check: {
    keywords: ['健康检查', '系统检查', '系统健康', '监控状态', '系统监控'],
    description: '系统健康检查',
    weight: 1.0
  }
};

const INTENT_TYPES = ['troubleshoot', 'query_status', 'log_analysis', 'system_health_check'] as const;

function localRecognizeIntent(input: string): IntentResult {
  const lowerInput = input.toLowerCase();
  let bestIntent: keyof typeof INTENTS | 'unknown' = 'unknown';
  let highestScore = 0;

  for (const [intentType, intentConfig] of Object.entries(INTENTS)) {
    let score = 0;
    for (const keyword of intentConfig.keywords) {
      if (lowerInput.includes(keyword)) {
        const keywordWeight = 1 + (keyword.length - 1) * 0.1;
        score += keywordWeight;
      }
    }
    const confidence = (score / (intentConfig.keywords.length * 2)) * (intentConfig.weight || 1.0);
    if (confidence > highestScore) {
      highestScore = confidence;
      bestIntent = intentType as keyof typeof INTENTS;
    }
  }

  const threshold = 0.3;
  if (highestScore < threshold) {
    return {
      intent: 'unknown',
      confidence: highestScore,
      description: '未知意图'
    };
  }

  return {
    intent: bestIntent as IntentResult['intent'],
    confidence: highestScore,
    description: INTENTS[bestIntent as keyof typeof INTENTS].description
  };
}

function getApiBaseUrl(config: LLMConfig): string {
  if (config.baseURL) return config.baseURL;
  if (config.provider === 'moonshot') return 'https://api.moonshot.cn/v1';
  if (config.provider === 'siliconflow') return 'https://api.siliconflow.cn/v1';
  return 'https://api.openai.com/v1';
}

function getDefaultModel(config: LLMConfig): string {
  if (config.provider === 'moonshot') return 'moonshot-v1-8k';
  if (config.provider === 'siliconflow') return 'THUDM/GLM-Z1-9B-0414';
  return 'gpt-3.5-turbo';
}

function resolveModel(config: LLMConfig): string {
  const m = typeof config.model === 'string' ? config.model.trim() : '';
  return m ? m : getDefaultModel(config);
}

function normalizeEntities(input: any): Record<string, unknown> {
  const src = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const toStrOrNull = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const toStrArrOrNull = (v: any) => {
    if (!Array.isArray(v)) return null;
    const arr = v.map(x => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
    return arr.length ? arr : null;
  };

  return {
    task: toStrOrNull((src as any).task),
    robotcode: toStrOrNull((src as any).robotcode),
    time: toStrOrNull((src as any).time),
    error_keyword: toStrArrOrNull((src as any).error_keyword),
    log_type: toStrOrNull((src as any).log_type),
    log_level: toStrOrNull((src as any).log_level),
    error_type: toStrOrNull((src as any).error_type),
    system_type: toStrOrNull((src as any).system_type),
  };
}

export async function analyzeInputOnce(
  input: string,
  llmConfig: LLMConfig
): Promise<CombinedAnalysisResult> {
  const baseURL = getApiBaseUrl(llmConfig);
  const model = resolveModel(llmConfig);

  const responseBody: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'system',
        content: `只输出JSON对象。字段: intentResult{intent,confidence,description}, entities{task,robotcode,time,error_keyword,log_type,log_level,error_type,system_type}, assistantReply。intent只能是troubleshoot/query_status/log_analysis/system_health_check/unknown。缺失填null。

判定规则：
1. 若输入包含运维信号（任务号/车号/数字编号/时间范围/日志/状态/故障/异常/错误/告警/下载/健康检查/排查/分析等），按对应运维意图处理，assistantReply=null；
2. 若输入不包含任何运维信号，则视为非运维对话（包括问候、闲聊、身份询问、技术咨询、感谢等），intent=unknown，assistantReply必须为非空自然中文(<=120字)；
3. 禁止在包含运维信号的回复中添加任何开场白或解释性内容。`
      },
      { role: 'user', content: input }
    ],
    temperature: 0.2,
  };

  if (llmConfig.provider === 'moonshot') {
    responseBody.response_format = { type: 'json_object' };
  }

  const data = await communicationService.callExternalJson(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`
    },
    body: responseBody,
    timeoutMs: 30000,
  });

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('空响应');

  let jsonStr = String(content).trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(jsonStr) as any;
  const intentResult = (parsed?.intentResult ?? parsed?.intent ?? parsed) as any;
  const entities = normalizeEntities(parsed?.entities ?? parsed);
  const assistantReply = parsed?.assistantReply;

  const intent = String(intentResult?.intent ?? 'unknown');
  const safeIntent: IntentResult['intent'] = (INTENT_TYPES as readonly string[]).includes(intent)
    ? (intent as IntentResult['intent'])
    : (intent === 'unknown' ? 'unknown' : 'unknown');

  return {
    intentResult: {
      intent: safeIntent,
      confidence: Math.min(1, Math.max(0, Number(intentResult?.confidence ?? 0.5))),
      description: String(intentResult?.description ?? '未知意图'),
      ai_analysis: typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : undefined,
    },
    entities,
    assistantReply: typeof assistantReply === 'string' ? assistantReply.slice(0, 200) : (assistantReply == null ? null : undefined),
    ai_raw: typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : undefined,
  };
}

export async function recognizeIntent(
  input: string,
  llmConfig: LLMConfig | null
): Promise<IntentResult> {
  if (!input || typeof input !== 'string') {
    return { intent: 'unknown', confidence: 0, description: '未知意图' };
  }

  if (llmConfig?.apiKey) {
    try {
      const baseURL = getApiBaseUrl(llmConfig);
      const model = resolveModel(llmConfig);
      const responseBody: Record<string, unknown> = {
        model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的意图识别助手，请严格分析用户输入的意图，返回标准JSON格式，只包含intent、confidence和description字段。intent字段必须为"troubleshoot"、"query_status"、"log_analysis"或"system_health_check"中的一个，confidence字段为0-1之间的数字，description字段为清晰的意图描述。如果输入包含车号、任务号、异常信息或时间范围等关键信息，也请在description中详细说明。只返回JSON，不要其他文本。'
          },
          { role: 'user', content: input }
        ],
        temperature: 0.3
      };

      if (llmConfig.provider === 'moonshot') {
        responseBody.response_format = { type: 'json_object' };
      }

      const data = await communicationService.callExternalJson(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`
        },
        body: responseBody,
        timeoutMs: 30000,
      });
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('空响应');

      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      const parsed = JSON.parse(jsonStr) as { intent?: string; confidence?: number; description?: string };

      if (parsed.intent && INTENT_TYPES.includes(parsed.intent as typeof INTENT_TYPES[number])) {
        return {
          intent: parsed.intent as IntentResult['intent'],
          confidence: Math.min(1, Math.max(0, Number(parsed.confidence) ?? 0.5)),
          description: parsed.description || INTENTS[parsed.intent as keyof typeof INTENTS]?.description || '未知意图',
          ai_analysis: parsed as Record<string, unknown>
        };
      }
    } catch (err) {
      logIntent.warn('LLM 调用失败，使用本地识别', err);
    }
  }

  return localRecognizeIntent(input);
}
