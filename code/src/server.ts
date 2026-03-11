import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// 账户管理
import {
  recordAccountSchema, recordAccountTool,
  updateAccountSchema, updateAccountTool,
  deleteAccountSchema, deleteAccountTool,
  listAccountsSchema, listAccountsTool,
  adjustAccountBalanceSchema, adjustAccountBalanceTool,
} from './tools/accounts/index.js';

// 交易记录
import {
  recordTransactionSchema, recordTransactionTool,
  updateTransactionSchema, updateTransactionTool,
  deleteTransactionSchema, deleteTransactionTool,
  listTransactionsSchema, listTransactionsTool,
  batchRecordTransactionsSchema, batchRecordTransactionsTool,
} from './tools/transactions/index.js';

// 分类管理
import {
  listCategoriesSchema, listCategoriesTool,
  recordCategorySchema, recordCategoryTool,
  updateCategorySchema, updateCategoryTool,
  deleteCategorySchema, deleteCategoryTool,
} from './tools/categories/index.js';

// 预算管理
import {
  setCategoryBudgetSchema, setCategoryBudgetTool,
  getBudgetStatusSchema, getBudgetStatusTool,
} from './tools/budgets/index.js';

// 分析报表
import {
  analyzeMonthlySummarySchema, analyzeMonthlySummaryTool,
  analyzeYearlySummarySchema, analyzeYearlySummaryTool,
  analyzeCategoryTrendSchema, analyzeCategoryTrendTool,
  analyzeBudgetReportSchema, analyzeBudgetReportTool,
  analyzeSpendingPatternSchema, analyzeSpendingPatternTool,
  analyzeTopExpensesSchema, analyzeTopExpensesTool,
  analyzeCashFlowSchema, analyzeCashFlowTool,
} from './tools/analysis/index.js';

// 净资产
import {
  recordNetWorthSnapshotSchema, recordNetWorthSnapshotTool,
  analyzeNetWorthTrendSchema, analyzeNetWorthTrendTool,
} from './tools/net-worth/index.js';

// 投资记录
import {
  recordInvestmentAccountSchema, recordInvestmentAccountTool,
  recordInvestmentTransactionSchema, recordInvestmentTransactionTool,
  listInvestmentHoldingsSchema, listInvestmentHoldingsTool,
  updateInvestmentValuationSchema, updateInvestmentValuationTool,
  analyzeInvestmentReturnSchema, analyzeInvestmentReturnTool,
} from './tools/investments/index.js';

// 订阅管理
import {
  recordSubscriptionSchema, recordSubscriptionTool,
  updateSubscriptionSchema, updateSubscriptionTool,
  listSubscriptionsSchema, listSubscriptionsTool,
} from './tools/subscriptions/index.js';

// 财务分摊
import {
  recordAmortizationSchema, recordAmortizationTool,
  updateAmortizationSchema, updateAmortizationTool,
  listAmortizationsSchema, listAmortizationsTool,
} from './tools/amortizations/index.js';

// 标签
import { listTagsSchema, listTagsTool } from './tools/tags/index.js';

// 审计日志
import {
  listAuditLogsSchema, listAuditLogsTool,
  restoreDeletedRecordSchema, restoreDeletedRecordTool,
} from './tools/audit/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tool 注册表
// ─────────────────────────────────────────────────────────────────────────────

type ToolHandler = (input: unknown) => Promise<unknown>;

interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: ToolHandler;
}

const tools: ToolDefinition[] = [
  // ── 账户管理（5）────────────────────────────────────────────────────────────
  {
    name: 'record_account',
    description: '创建一个新的资金账户（银行卡/支付宝/微信/现金等）',
    schema: recordAccountSchema,
    handler: recordAccountTool as ToolHandler,
  },
  {
    name: 'update_account',
    description: '修改已有账户的名称或备注信息',
    schema: updateAccountSchema,
    handler: updateAccountTool as ToolHandler,
  },
  {
    name: 'delete_account',
    description: '软删除账户（账户下无交易或使用 force=true）',
    schema: deleteAccountSchema,
    handler: deleteAccountTool as ToolHandler,
  },
  {
    name: 'list_accounts',
    description: '查询所有账户及实时余额，响应包含净资产汇总（total_assets / total_liabilities / net_worth）',
    schema: listAccountsSchema,
    handler: listAccountsTool as ToolHandler,
  },
  {
    name: 'adjust_account_balance',
    description: '手动校正账户余额（与实际银行账单对账时使用），自动生成余额调整系统交易记录',
    schema: adjustAccountBalanceSchema,
    handler: adjustAccountBalanceTool as ToolHandler,
  },

  // ── 交易记录（5）────────────────────────────────────────────────────────────
  {
    name: 'record_transaction',
    description: '记录一笔收入/支出/转账。写入后自动检查分类预算并在响应中附带预警信息和建议标签（suggested_tag_labels）',
    schema: recordTransactionSchema,
    handler: recordTransactionTool as ToolHandler,
  },
  {
    name: 'batch_record_transactions',
    description: '批量录入多条交易（由 AI 客户端预先解析自然语言后传入结构化列表）。支持 dry_run 预览模式，保留 source_text 原文溯源',
    schema: batchRecordTransactionsSchema,
    handler: batchRecordTransactionsTool as ToolHandler,
  },
  {
    name: 'update_transaction',
    description: '修改已有交易记录（金额/分类/账户/时间/备注/标签），修改前后均记录审计日志',
    schema: updateTransactionSchema,
    handler: updateTransactionTool as ToolHandler,
  },
  {
    name: 'delete_transaction',
    description: '软删除一条交易记录，同时回滚该交易对账户余额的影响',
    schema: deleteTransactionSchema,
    handler: deleteTransactionTool as ToolHandler,
  },
  {
    name: 'list_transactions',
    description: '多条件过滤查询交易记录列表（时间/分类/账户/金额/关键词/标签）。传入 transaction_id 时返回单条详情（可含修改历史）',
    schema: listTransactionsSchema,
    handler: listTransactionsTool as ToolHandler,
  },

  // ── 分类管理（4）────────────────────────────────────────────────────────────
  {
    name: 'list_categories',
    description: '查询分类列表，返回含父子关系的两级分类树结构',
    schema: listCategoriesSchema,
    handler: listCategoriesTool as ToolHandler,
  },
  {
    name: 'record_category',
    description: '新增自定义分类（最多 2 级：传 parent_id 创建二级分类，不传创建一级分类）',
    schema: recordCategorySchema,
    handler: recordCategoryTool as ToolHandler,
  },
  {
    name: 'update_category',
    description: '编辑分类信息（名称/图标/颜色），通过 hidden 字段控制分类的显示/隐藏状态',
    schema: updateCategorySchema,
    handler: updateCategoryTool as ToolHandler,
  },
  {
    name: 'delete_category',
    description: '删除自定义分类（预设分类只能隐藏不能删除）。若有关联交易须提供 replace_category_id',
    schema: deleteCategorySchema,
    handler: deleteCategoryTool as ToolHandler,
  },

  // ── 预算管理（2）────────────────────────────────────────────────────────────
  {
    name: 'set_category_budget',
    description: '为指定分类设置月度预算，支持 recurring（自动延续到下月）和 alert_threshold（预警阈值）',
    schema: setCategoryBudgetSchema,
    handler: setCategoryBudgetTool as ToolHandler,
  },
  {
    name: 'get_budget_status',
    description: '查询指定月份各分类的预算执行情况（已用/剩余/超支预警）',
    schema: getBudgetStatusSchema,
    handler: getBudgetStatusTool as ToolHandler,
  },

  // ── 分析报表（7）────────────────────────────────────────────────────────────
  {
    name: 'analyze_monthly_summary',
    description: '月度收支汇总：总收入/支出/结余、按分类细分、与上月对比。支持分摊调整（include_amortized）',
    schema: analyzeMonthlySummarySchema,
    handler: analyzeMonthlySummaryTool as ToolHandler,
  },
  {
    name: 'analyze_yearly_summary',
    description: '年度收支汇总：全年总览、12 个月月度对比、支出最多的分类 Top 5',
    schema: analyzeYearlySummarySchema,
    handler: analyzeYearlySummaryTool as ToolHandler,
  },
  {
    name: 'analyze_category_trend',
    description: '指定分类的历史支出趋势分析（最近 N 个月，含环比变化率）',
    schema: analyzeCategoryTrendSchema,
    handler: analyzeCategoryTrendTool as ToolHandler,
  },
  {
    name: 'analyze_budget_report',
    description: '预算执行报告：对指定月份的预算执行情况做完整分析，适合月末复盘',
    schema: analyzeBudgetReportSchema,
    handler: analyzeBudgetReportTool as ToolHandler,
  },
  {
    name: 'analyze_spending_pattern',
    description: '消费习惯分析：按星期分布、高峰时段等特征，识别消费规律',
    schema: analyzeSpendingPatternSchema,
    handler: analyzeSpendingPatternTool as ToolHandler,
  },
  {
    name: 'analyze_top_expenses',
    description: '查询指定期间内支出金额最高的 Top N 条交易记录',
    schema: analyzeTopExpensesSchema,
    handler: analyzeTopExpensesTool as ToolHandler,
  },
  {
    name: 'analyze_cash_flow',
    description: '现金流分析：按日/周/月展示资金流入/流出情况，识别资金高峰低谷期',
    schema: analyzeCashFlowSchema,
    handler: analyzeCashFlowTool as ToolHandler,
  },

  // ── 净资产（2）──────────────────────────────────────────────────────────────
  {
    name: 'record_net_worth_snapshot',
    description: '手动触发净资产快照记录（建议每月初调用）。实时净资产通过 list_accounts 获取',
    schema: recordNetWorthSnapshotSchema,
    handler: recordNetWorthSnapshotTool as ToolHandler,
  },
  {
    name: 'analyze_net_worth_trend',
    description: '查看净资产的历史快照变化趋势',
    schema: analyzeNetWorthTrendSchema,
    handler: analyzeNetWorthTrendTool as ToolHandler,
  },

  // ── 投资记录（5）────────────────────────────────────────────────────────────
  {
    name: 'record_investment_account',
    description: '创建投资账户（股票/基金/加密货币等）',
    schema: recordInvestmentAccountSchema,
    handler: recordInvestmentAccountTool as ToolHandler,
  },
  {
    name: 'record_investment_transaction',
    description: '记录投资交易（买入/卖出/分红/手续费）',
    schema: recordInvestmentTransactionSchema,
    handler: recordInvestmentTransactionTool as ToolHandler,
  },
  {
    name: 'list_investment_holdings',
    description: '查询投资持仓（按品种聚合持仓成本和数量）',
    schema: listInvestmentHoldingsSchema,
    handler: listInvestmentHoldingsTool as ToolHandler,
  },
  {
    name: 'update_investment_valuation',
    description: '手动更新投资账户当前市值（不接入实时行情，需用户手动更新）',
    schema: updateInvestmentValuationSchema,
    handler: updateInvestmentValuationTool as ToolHandler,
  },
  {
    name: 'analyze_investment_return',
    description: '计算投资收益：总投入成本、当前估值、收益金额、收益率',
    schema: analyzeInvestmentReturnSchema,
    handler: analyzeInvestmentReturnTool as ToolHandler,
  },

  // ── 订阅管理（3）────────────────────────────────────────────────────────────
  {
    name: 'record_subscription',
    description: '记录一个周期性订阅服务（Netflix/ChatGPT Plus 等），追踪下次扣费日',
    schema: recordSubscriptionSchema,
    handler: recordSubscriptionTool as ToolHandler,
  },
  {
    name: 'update_subscription',
    description: '修改订阅信息或将状态设为「已取消」',
    schema: updateSubscriptionSchema,
    handler: updateSubscriptionTool as ToolHandler,
  },
  {
    name: 'list_subscriptions',
    description: '查询订阅列表，高亮展示近期即将扣费的订阅，返回折算月费总计',
    schema: listSubscriptionsSchema,
    handler: listSubscriptionsTool as ToolHandler,
  },

  // ── 财务分摊（3）────────────────────────────────────────────────────────────
  {
    name: 'record_amortization',
    description: '为一笔大额支出创建按月分摊计划，使月度报告更真实反映消费水平（原始账户余额不变）',
    schema: recordAmortizationSchema,
    handler: recordAmortizationTool as ToolHandler,
  },
  {
    name: 'update_amortization',
    description: '修改分摊参数或终止分摊计划（取消后已过去月份的分摊保留，剩余月份不再分摊）',
    schema: updateAmortizationSchema,
    handler: updateAmortizationTool as ToolHandler,
  },
  {
    name: 'list_amortizations',
    description: '查询所有分摊计划及每月摊销进度，支持按月份筛选当月生效的计划',
    schema: listAmortizationsSchema,
    handler: listAmortizationsTool as ToolHandler,
  },

  // ── 标签（1）────────────────────────────────────────────────────────────────
  {
    name: 'list_tags',
    description: '返回完整的结构化标签体系（5 个维度 × 预设值），附带每个标签的历史使用频次。AI 客户端应在打标签前调用此工具确认可选值',
    schema: listTagsSchema,
    handler: listTagsTool as ToolHandler,
  },

  // ── 审计日志（2）────────────────────────────────────────────────────────────
  {
    name: 'list_audit_logs',
    description: '查询操作日志。传入 resource_id 时返回该记录的完整修改历史（含修改前后字段对比）',
    schema: listAuditLogsSchema,
    handler: listAuditLogsTool as ToolHandler,
  },
  {
    name: 'restore_deleted_record',
    description: '从软删除中恢复任意类型的记录（交易/账户/分类/订阅/分摊计划）',
    schema: restoreDeletedRecordSchema,
    handler: restoreDeletedRecordTool as ToolHandler,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server 初始化
// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'personal-finance-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 列出所有 Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: zodToJsonSchema(tool.schema),
        required: getRequiredFields(tool.schema),
      },
    })),
  };
});

// 执行 Tool 调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: `未找到 Tool: ${name}` } }),
        },
      ],
    };
  }

  try {
    const parsed = tool.schema.safeParse(args ?? {});
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const fieldMessages = Object.entries(flattened.fieldErrors)
        .map(([field, msgs]) => `「${field}」${(msgs as string[]).join('；')}`)
        .join('，');
      const formMessages = flattened.formErrors.length > 0 ? flattened.formErrors.join('；') : '';
      const detailMessage = [fieldMessages, formMessages].filter(Boolean).join('；');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: `参数校验失败：${detailMessage}`,
                details: flattened,
              },
            }),
          },
        ],
      };
    }

    const result = await tool.handler(parsed.data);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isSensitive = /password|host|connect|ECONNREFUSED/i.test(errMsg);
    const message = isSensitive ? '数据库连接失败，请稍后重试' : `服务内部错误：${errMsg}`;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: { code: isSensitive ? 'DATABASE_ERROR' : 'INTERNAL_ERROR', message },
          }),
        },
      ],
      isError: true,
    };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Zod → JSON Schema 转换（简化版）
// ─────────────────────────────────────────────────────────────────────────────

function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodFieldToJsonSchema(value as z.ZodTypeAny);
  }

  return properties;
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): Record<string, unknown> {
  const description = field.description;

  if (field instanceof z.ZodString) {
    return { type: 'string', ...(description && { description }) };
  }
  if (field instanceof z.ZodNumber) {
    return { type: 'number', ...(description && { description }) };
  }
  if (field instanceof z.ZodBoolean) {
    return { type: 'boolean', ...(description && { description }) };
  }
  if (field instanceof z.ZodEnum) {
    return { type: 'string', enum: field.options, ...(description && { description }) };
  }
  if (field instanceof z.ZodOptional) {
    return zodFieldToJsonSchema(field.unwrap());
  }
  if (field instanceof z.ZodDefault) {
    return zodFieldToJsonSchema(field._def.innerType);
  }
  if (field instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodFieldToJsonSchema(field.element),
      ...(description && { description }),
    };
  }
  if (field instanceof z.ZodObject) {
    return {
      type: 'object',
      properties: zodToJsonSchema(field),
      ...(description && { description }),
    };
  }
  if (field instanceof z.ZodNullable) {
    return zodFieldToJsonSchema(field.unwrap());
  }

  return { type: 'string', ...(description && { description }) };
}

function getRequiredFields(schema: z.ZodObject<z.ZodRawShape>): string[] {
  const required: string[] = [];
  const shape = schema.shape;

  for (const [key, value] of Object.entries(shape)) {
    const field = value as z.ZodTypeAny;
    if (!(field instanceof z.ZodOptional) && !(field instanceof z.ZodDefault)) {
      required.push(key);
    }
  }

  return required;
}

// ─────────────────────────────────────────────────────────────────────────────
// 启动服务
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Personal Finance MCP Server running on stdio (${tools.length} tools loaded)`);
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
