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
  provider: 'moonshot' | 'openai';
  baseURL?: string;
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
  return 'https://api.openai.com/v1';
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
      const responseBody: Record<string, unknown> = {
        model: llmConfig.provider === 'moonshot' ? 'moonshot-v1-8k' : 'gpt-3.5-turbo',
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

      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify(responseBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
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
      console.warn('[IntentService] LLM 调用失败，使用本地识别:', err);
    }
  }

  return localRecognizeIntent(input);
}
