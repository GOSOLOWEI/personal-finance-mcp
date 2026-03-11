# 个人财务管理 MCP 服务实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个基于 MCP 标准的个人财务管理服务，支持 39 个 Tools，覆盖账户/交易/分类/预算/分析/净资产/投资/订阅/分摊/审计 10 大模块

**Architecture:** TypeScript + Node.js MCP Server，通过 Drizzle ORM 连接 PostgreSQL，所有 Tool 入参通过 Zod 校验，Service 层封装业务逻辑。分 4 阶段交付，每阶段独立可运行。

**Tech Stack:** Node.js 22+, TypeScript 5.x, @modelcontextprotocol/sdk, PostgreSQL 16+, Drizzle ORM, Zod, date-fns, dotenv, ESLint + Prettier

**代码目录:** `code/` （项目根目录下）

---

## 阶段一：基础骨架（核心记账能力）

### Task 1: 项目初始化

**Files:**
- Create: `code/package.json`
- Create: `code/tsconfig.json`
- Create: `code/.eslintrc.json`
- Create: `code/.prettierrc`
- Create: `code/.env.example`
- Create: `code/drizzle.config.ts`

**Step 1: 创建 code 目录并初始化项目**

在 `code/` 目录下创建以下文件。

**Step 2: 安装依赖**

```bash
cd code
npm install
```

Expected: node_modules 创建成功

**Step 3: 验证 TypeScript 编译**

```bash
npm run build
```

Expected: dist/ 目录生成，无编译错误

**Step 4: Commit**

```bash
git add code/
git commit -m "feat: initialize project scaffold with TypeScript, Drizzle, MCP SDK"
```

---

### Task 2: 数据库 Schema 定义

**Files:**
- Create: `code/src/db/schema.ts`
- Create: `code/src/db/client.ts`

**Step 1: 编写 Drizzle Schema（13 张表）**

包含：users, accounts, categories, transactions, budgets, tag_definitions, subscriptions, amortizations, investment_accounts, investment_transactions, investment_valuations, net_worth_snapshots, audit_logs

**Step 2: 验证 Schema 无 TypeScript 错误**

```bash
npm run typecheck
```

Expected: 0 errors

**Step 3: 生成迁移文件**

```bash
npm run db:generate
```

Expected: `src/db/migrations/` 下生成 SQL 文件

**Step 4: Commit**

```bash
git add code/src/db/
git commit -m "feat: define Drizzle ORM schema for all 13 tables"
```

---

### Task 3: 数据库迁移 + 种子数据

**Files:**
- Create: `code/src/db/seed.ts`
- Modify: `code/src/db/migrations/` (Drizzle 生成)

**Step 1: 执行迁移**

```bash
npm run db:migrate
```

Expected: 所有表创建成功

**Step 2: 编写种子数据脚本（预设分类 + 标签体系 + 默认用户）**

**Step 3: 执行种子数据**

```bash
npm run db:seed
```

Expected: 111 条分类记录插入，11 条标签定义插入，1 条默认用户插入

**Step 4: Commit**

```bash
git add code/src/db/seed.ts
git commit -m "feat: add seed data for preset categories and tag definitions"
```

---

### Task 4: 工具函数与公共模块

**Files:**
- Create: `code/src/utils/errors.ts`
- Create: `code/src/utils/response.ts`
- Create: `code/src/utils/validators.ts`
- Create: `code/src/utils/audit.ts`

**Step 1: 定义统一错误响应格式**

```typescript
export function errorResponse(code: string, message: string, details?: unknown) {
  return { success: false, error: { code, message, details } };
}
export function successResponse<T>(data: T, message?: string) {
  return { success: true, data, message };
}
```

**Step 2: 审计日志工具函数**

```typescript
export async function writeAuditLog(params: { action, resource_type, resource_id, changes, tool_name, user_id })
```

**Step 3: Commit**

```bash
git add code/src/utils/
git commit -m "feat: add shared utilities for error handling, responses, and audit logging"
```

---

### Task 5: MCP Server 入口

**Files:**
- Create: `code/src/server.ts`

**Step 1: 创建基础 MCP Server，注册空 Tool 列表**

**Step 2: 本地运行验证**

```bash
npm run dev
```

Expected: MCP Server 启动，输出 "Personal Finance MCP Server running on stdio"

**Step 3: Commit**

```bash
git add code/src/server.ts
git commit -m "feat: bootstrap MCP server with stdio transport"
```

---

### Task 6: 账户管理 Service + Tools（5 个）

**Files:**
- Create: `code/src/services/accounts.service.ts`
- Create: `code/src/tools/accounts/record_account.ts`
- Create: `code/src/tools/accounts/update_account.ts`
- Create: `code/src/tools/accounts/delete_account.ts`
- Create: `code/src/tools/accounts/list_accounts.ts`
- Create: `code/src/tools/accounts/adjust_account_balance.ts`
- Create: `code/src/tools/accounts/index.ts`

**Step 1: 实现 AccountsService**

核心方法：
- `createAccount(params)` → 插入 accounts 表
- `updateAccount(id, params)` → 更新账户
- `deleteAccount(id, force)` → 软删除，检查余额和关联交易
- `listAccounts(params)` → 查询账户列表 + 净资产汇总（通过 v_account_balances 视图）
- `adjustBalance(id, actual_balance, note)` → 生成余额调整交易

**Step 2: 实现 5 个 Tool 定义（Zod 入参校验 + Tool 描述）**

**Step 3: 在 server.ts 注册账户管理 Tools**

**Step 4: 验证运行**

```bash
npm run dev
```

Expected: Server 启动，accounts 相关 Tools 出现在 Tool 列表

**Step 5: Commit**

```bash
git add code/src/services/accounts.service.ts code/src/tools/accounts/
git commit -m "feat: implement account management tools (record/update/delete/list/adjust)"
```

---

### Task 7: 交易记录 Service + Tools（核心 4 个）

**Files:**
- Create: `code/src/services/transactions.service.ts`
- Create: `code/src/tools/transactions/record_transaction.ts`
- Create: `code/src/tools/transactions/update_transaction.ts`
- Create: `code/src/tools/transactions/delete_transaction.ts`
- Create: `code/src/tools/transactions/list_transactions.ts`
- Create: `code/src/tools/transactions/index.ts`

**Step 1: 实现 TransactionsService 核心方法**

- `recordTransaction(params)` → 插入交易 + 更新账户余额 + 检查预算预警 + 返回 suggested_tag_labels
- `updateTransaction(id, params)` → 更新交易 + 回滚旧余额 + 应用新余额变更 + 写审计日志
- `deleteTransaction(id, reason)` → 软删除 + 回滚账户余额 + 写审计日志
- `listTransactions(params)` → 多条件过滤分页查询（支持单条 ID 查询含修改历史）

**Step 2: 标签推断逻辑（Server 端规则）**

在 `record_transaction` 响应中返回 `suggested_tag_labels`：
- `scale`: amount >= 500 → "大额支出", 否则 "小额支出"
- `method`: 关键词匹配 note 字段
- `consumption_type` / `purpose`: 基于 category 一级分类名称映射

**Step 3: 在 server.ts 注册交易记录 Tools**

**Step 4: Commit**

```bash
git add code/src/services/transactions.service.ts code/src/tools/transactions/
git commit -m "feat: implement transaction tools with balance updates and tag suggestions"
```

---

### Task 8: 分类管理 Service + Tools（3 个）

**Files:**
- Create: `code/src/services/categories.service.ts`
- Create: `code/src/tools/categories/list_categories.ts`
- Create: `code/src/tools/categories/record_category.ts`
- Create: `code/src/tools/categories/update_category.ts`
- Create: `code/src/tools/categories/index.ts`

**Step 1: 实现 CategoriesService**

- `listCategories(type, include_hidden)` → 返回两级分类树
- `createCategory(params)` → 创建自定义分类，校验最多 2 级
- `updateCategory(id, params)` → 更新分类信息，含 hidden 字段

**Step 2: 在 server.ts 注册**

**Step 3: Commit**

```bash
git add code/src/services/categories.service.ts code/src/tools/categories/
git commit -m "feat: implement category management tools (list/record/update)"
```

---

## 阶段二：智能录入 + 预算 + 订阅

### Task 9: 批量自然语言录入 Tool

**Files:**
- Create: `code/src/tools/transactions/batch_record_transactions.ts`

**Step 1: 实现 batch_record_transactions Tool**

解析 `raw_text` 中的多条交易，支持 `dry_run` 预览模式，保留 `source_text` 字段。

**Step 2: Commit**

```bash
git add code/src/tools/transactions/batch_record_transactions.ts
git commit -m "feat: add batch transaction recording with natural language input"
```

---

### Task 10: 分类管理补全 + 预算管理 Tools

**Files:**
- Create: `code/src/tools/categories/delete_category.ts`
- Create: `code/src/services/budgets.service.ts`
- Create: `code/src/tools/budgets/set_category_budget.ts`
- Create: `code/src/tools/budgets/get_budget_status.ts`
- Create: `code/src/tools/budgets/index.ts`

**Step 1: 实现 delete_category（仅自定义分类，支持 replace_category_id）**

**Step 2: 实现 BudgetsService**

- `setCategoryBudget(params)` → upsert 预算，支持 recurring
- `getBudgetStatus(year_month)` → 查询各分类预算执行情况
- `checkBudgetWarning(category_id, user_id, year_month)` → 返回预警信息（供 record_transaction 调用）

**Step 3: Commit**

```bash
git add code/src/tools/categories/delete_category.ts code/src/services/budgets.service.ts code/src/tools/budgets/
git commit -m "feat: add budget management and category delete tools"
```

---

### Task 11: 订阅管理 + 标签 Tools

**Files:**
- Create: `code/src/services/subscriptions.service.ts`
- Create: `code/src/tools/subscriptions/record_subscription.ts`
- Create: `code/src/tools/subscriptions/update_subscription.ts`
- Create: `code/src/tools/subscriptions/list_subscriptions.ts`
- Create: `code/src/tools/subscriptions/index.ts`
- Create: `code/src/services/tags.service.ts`
- Create: `code/src/tools/tags/list_tags.ts`
- Create: `code/src/tools/tags/index.ts`

**Step 1: 实现 SubscriptionsService**

- `createSubscription(params)` → 插入订阅记录
- `updateSubscription(id, params)` → 更新订阅，支持取消
- `listSubscriptions(status, upcoming_days)` → 查询订阅列表，计算 days_until_billing 和 annual_cost

**Step 2: 实现 TagsService.listTags()** → 查询 tag_definitions + 统计各标签使用次数

**Step 3: Commit**

```bash
git add code/src/services/subscriptions.service.ts code/src/tools/subscriptions/ code/src/services/tags.service.ts code/src/tools/tags/
git commit -m "feat: add subscription management and tag listing tools"
```

---

## 阶段三：分析报表 + 财务分摊 + 净资产

### Task 12: 财务分摊 Tools

**Files:**
- Create: `code/src/services/amortizations.service.ts`
- Create: `code/src/tools/amortizations/record_amortization.ts`
- Create: `code/src/tools/amortizations/update_amortization.ts`
- Create: `code/src/tools/amortizations/list_amortizations.ts`
- Create: `code/src/tools/amortizations/index.ts`

**Step 1: 实现 AmortizationsService**

- `createAmortization(params)` → 验证交易类型为 expense，计算 monthly_amount
- `updateAmortization(id, params)` → 修改参数或取消，校验 total_months >= 已摊销月数
- `listAmortizations(status, year_month)` → 查询分摊计划，计算 elapsed/remaining months

**Step 2: Commit**

```bash
git add code/src/services/amortizations.service.ts code/src/tools/amortizations/
git commit -m "feat: implement financial amortization tools"
```

---

### Task 13: 分析报表 Tools（7 个）

**Files:**
- Create: `code/src/services/analysis.service.ts`
- Create: `code/src/tools/analysis/analyze_monthly_summary.ts`
- Create: `code/src/tools/analysis/analyze_yearly_summary.ts`
- Create: `code/src/tools/analysis/analyze_category_trend.ts`
- Create: `code/src/tools/analysis/analyze_budget_report.ts`
- Create: `code/src/tools/analysis/analyze_spending_pattern.ts`
- Create: `code/src/tools/analysis/analyze_top_expenses.ts`
- Create: `code/src/tools/analysis/analyze_cash_flow.ts`
- Create: `code/src/tools/analysis/index.ts`

**Step 1: 实现 AnalysisService**

利用 `v_monthly_category_summary` 和 `v_amortization_by_month` 视图进行聚合计算。

**Step 2: Commit**

```bash
git add code/src/services/analysis.service.ts code/src/tools/analysis/
git commit -m "feat: implement 7 analysis and reporting tools"
```

---

### Task 14: 净资产 Tools

**Files:**
- Create: `code/src/services/net-worth.service.ts`
- Create: `code/src/tools/net-worth/record_net_worth_snapshot.ts`
- Create: `code/src/tools/net-worth/analyze_net_worth_trend.ts`
- Create: `code/src/tools/net-worth/index.ts`

**Step 1: 实现 NetWorthService**

- `recordSnapshot(note)` → 读取当前账户余额，插入快照记录
- `analyzeTrend(months)` → 查询历史快照，计算变化趋势

**Step 2: Commit**

```bash
git add code/src/services/net-worth.service.ts code/src/tools/net-worth/
git commit -m "feat: add net worth snapshot and trend analysis tools"
```

---

## 阶段四：投资记录 + 审计日志 + 生产就绪

### Task 15: 投资记录 Tools（5 个）

**Files:**
- Create: `code/src/services/investments.service.ts`
- Create: `code/src/tools/investments/record_investment_account.ts`
- Create: `code/src/tools/investments/record_investment_transaction.ts`
- Create: `code/src/tools/investments/list_investment_holdings.ts`
- Create: `code/src/tools/investments/update_investment_valuation.ts`
- Create: `code/src/tools/investments/analyze_investment_return.ts`
- Create: `code/src/tools/investments/index.ts`

**Step 1: 实现 InvestmentsService**

- `createAccount(params)` → 创建投资账户
- `recordTransaction(params)` → 记录买入/卖出/分红/手续费
- `listHoldings(account_id?)` → 按品种聚合持仓成本
- `updateValuation(account_id, current_value, date)` → 更新市值快照
- `analyzeReturn(account_id?)` → 计算总收益率

**Step 2: Commit**

```bash
git add code/src/services/investments.service.ts code/src/tools/investments/
git commit -m "feat: implement investment account and transaction tools"
```

---

### Task 16: 审计日志 Tools（2 个）

**Files:**
- Create: `code/src/services/audit.service.ts`
- Create: `code/src/tools/audit/list_audit_logs.ts`
- Create: `code/src/tools/audit/restore_deleted_record.ts`
- Create: `code/src/tools/audit/index.ts`

**Step 1: 实现 AuditService**

- `listAuditLogs(params)` → 查询操作日志，支持 resource_id 查看变更历史
- `restoreDeletedRecord(resource_type, resource_id)` → 恢复软删除记录，更新 deleted_at = NULL

**Step 2: Commit**

```bash
git add code/src/services/audit.service.ts code/src/tools/audit/
git commit -m "feat: implement audit log query and record restore tools"
```

---

### Task 17: 错误处理完善 + 连接池配置

**Files:**
- Modify: `code/src/db/client.ts`
- Modify: `code/src/server.ts`

**Step 1: 数据库连接池配置（min=2, max=10, timeout=10s）**

**Step 2: 全局错误捕获，确保 DB 错误不暴露连接串**

**Step 3: Commit**

```bash
git commit -m "feat: configure connection pool and improve error handling"
```

---

### Task 18: README 更新

**Files:**
- Modify: `README.md`

**Step 1: 更新 README，添加 Claude Desktop 和 Cursor 配置教程**

**Step 2: Commit**

```bash
git commit -m "docs: update README with setup guide for Claude Desktop and Cursor"
```
