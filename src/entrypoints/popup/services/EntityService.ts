import { createLogger } from '../../../utils/logger';
import communicationService from './CommunicationService';

const logEntity = createLogger('entity');

/**
 * 前端实体抽取服务
 * 因后端无法连接外网，实体抽取在前端完成，调用 LLM API（需用户配置 API Key）
 */
export interface ExtractedEntities {
  task: string | null;
  robotcode: string | null;
  time: string | null;
  error_keyword: string[] | null;
  log_type: string | null;
  log_level: string | null;
  error_type: string | null;
  system_type: string | null;
  original_input?: string;
}

export interface LLMConfig {
  apiKey: string;
  provider: 'moonshot' | 'openai' | 'siliconflow';
  baseURL?: string;
  model?: string;
}

const PATTERNS = {
  time_range: /(?:\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(:\d{2})?)?|\d{2}-\d{2}(?:\s+\d{2}:\d{2})?|昨天|今天|最近(?:\d+小时|\d+天|\d+分钟))/g,
  error_keyword: /(?:电池|通信|定位|导航|避障|充电|电机|驱动|传感器|网络|连接|系统|程序|软件|硬件|算法|规划|分配|状态|运行|执行|完成|超时)\s*(?:故障|异常|问题|错误|低|高|不稳定|失效|故障|报警|警告|失败|超时|中断|缓慢|延迟|卡顿)/g,
  log_level: /(?:ERROR|WARN|WARNING|INFO|DEBUG|TRACE)/g
};

const emptyEntities = (): ExtractedEntities => ({
  task: null,
  robotcode: null,
  time: null,
  error_keyword: null,
  log_type: null,
  log_level: null,
  error_type: null,
  system_type: null
});

function localExtractEntities(input: string): ExtractedEntities {
  const result = emptyEntities();
  const lowerInput = input.toLowerCase();

  let taskMatches = input.match(/(?:任务号|任务|订单|工单)\s*[为:：]?\s*([\w\-]+)/i);
  if (taskMatches?.[1]) {
    result.task = taskMatches[1].trim();
  } else {
    taskMatches = input.match(/(?:A|RETURN)\d{20,}(?:RETURN)?|T\d{12,14}/i);
    if (taskMatches) result.task = taskMatches[0].trim();
  }

  let robotMatches = input.match(/(?:车号|AGV|AMR|RCS|机器人|小车)\s*[:：]?\s*(\w+)/i);
  if (robotMatches?.[1]) {
    result.robotcode = robotMatches[1].trim();
  } else {
    robotMatches = input.match(/(?:AGV|RCS|AMR)-?\d{3,6}|\d{3,6}/g);
    if (robotMatches?.length) {
      const v = robotMatches.find(m => /^\d{3,6}$/.test(m) || /^(?:AGV|RCS|AMR)-?\d{3,6}$/.test(m));
      if (v) result.robotcode = v.trim();
    }
  }

  const timeMatches = input.match(PATTERNS.time_range);
  if (timeMatches?.length) result.time = timeMatches[0];

  const errorMatches = input.match(PATTERNS.error_keyword);
  if (errorMatches?.length) result.error_keyword = [...new Set(errorMatches)].map(k => k.trim());

  if (lowerInput.includes('平台')) result.log_type = 'platform';
  else if (lowerInput.includes('agv') || lowerInput.includes('小车')) result.log_type = 'agv';
  else if (lowerInput.includes('rcs')) result.log_type = 'rcs';
  else if (lowerInput.includes('分配') || lowerInput.includes('调度')) result.log_type = 'dispatch';
  else if (lowerInput.includes('算法')) result.log_type = 'algorithm';
  else if (lowerInput.includes('wcs')) result.log_type = 'wcs';
  else if (lowerInput.includes('规划')) result.log_type = 'plan';
  else if (lowerInput.includes('配置')) result.log_type = 'config';

  const logLevelMatches = input.match(PATTERNS.log_level);
  if (logLevelMatches?.length) result.log_level = logLevelMatches[0].trim();

  if (result.error_keyword?.length) result.error_type = result.error_keyword[0];

  if (lowerInput.includes('rcs')) result.system_type = 'RCS';
  else if (lowerInput.includes('wcs')) result.system_type = 'WCS';
  else if (lowerInput.includes('算法')) result.system_type = '算法系统';
  else if (lowerInput.includes('分配') || lowerInput.includes('调度')) result.system_type = '分配系统';
  else if (lowerInput.includes('规划')) result.system_type = '规划系统';

  return result;
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

export async function extractEntities(
  input: string,
  llmConfig: LLMConfig | null
): Promise<ExtractedEntities> {
  if (!input || typeof input !== 'string') return emptyEntities();

  if (llmConfig?.apiKey) {
    try {
      const baseURL = getApiBaseUrl(llmConfig);
      const model = resolveModel(llmConfig);
      const responseBody: Record<string, unknown> = {
        model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的实体提取助手，需要从用户输入中提取关键实体，返回标准JSON格式。包含以下字段：- task（任务号）- robotcode（AMR编号/车号）- time（时间范围）- error_keyword（异常关键词数组）- log_type（platform/agv/rcs/wcs/algorithm/dispatch/plan/config之一）- log_level（ERROR/WARN/INFO等）- error_type（错误类型）- system_type（RCS/WCS/算法系统等）若无相关实体，对应字段为null。只返回JSON，不要其他文本。'
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
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      const entities = (parsed.entities ?? parsed) as Partial<ExtractedEntities>;

      const result: ExtractedEntities = {
        task: typeof entities.task === 'string' ? entities.task : null,
        robotcode: typeof entities.robotcode === 'string' ? entities.robotcode : null,
        time: typeof entities.time === 'string' ? entities.time : null,
        error_keyword: Array.isArray(entities.error_keyword) ? entities.error_keyword : null,
        log_type: typeof entities.log_type === 'string' ? entities.log_type : null,
        log_level: typeof entities.log_level === 'string' ? entities.log_level : null,
        error_type: typeof entities.error_type === 'string' ? entities.error_type : null,
        system_type: typeof entities.system_type === 'string' ? entities.system_type : null,
        original_input: input
      };
      return result;
    } catch (err) {
      logEntity.warn('LLM 调用失败，使用本地抽取', err);
    }
  }

  const result = localExtractEntities(input);
  result.original_input = input;
  return result;
}
