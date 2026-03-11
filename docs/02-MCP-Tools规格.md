# MCP Tools 规格文档

> 版本：v0.3.0  
> 创建日期：2026-03-11  
> 更新日期：2026-03-11  
> 关联文档：[01-功能设计文档.md](./01-功能设计文档.md)

---

## 一、Tool 总览

共计 **39 个 MCP Tools**，按功能模块分组：

| 模块 | Tool 数量 | 说明 |
|---|---|---|
| 账户管理 | 5 | 账户的增删改查，响应含净资产汇总 |
| 交易记录 | 5 | 收支记录核心操作，含批量自然语言录入 |
| 分类管理 | 4 | 二级分类体系维护 |
| 预算管理 | 2 | 分类预算设置与追踪（无月度总预算） |
| 分析报表 | 7 | 多维度财务分析 |
| 净资产 | 2 | 资产负债快照与趋势 |
| 投资记录 | 5 | 投资账户与交易 |
| 订阅管理 | 3 | 周期性订阅扣费追踪 |
| 财务分摊 | 3 | 大额支出按月摊销 |
| 标签 | 1 | 查询已使用标签 |
| 审计日志 | 2 | 操作历史与恢复（含变更历史查询） |

> **v0.1 → v0.2 变更摘要**：移除 10 个冗余/废弃 Tool（`suggest_category`、`get_transaction`、`restore_transaction`、`get_net_worth`、`toggle_category_visibility`、`get_change_history`、`set_monthly_budget`、`record_savings_goal`、`update_savings_goal`、`list_savings_goals`），新增 13 个 Tool（订阅管理 3 + 财务分摊 3 + 批量录入 1 + 标签 1 + 净资产优化后保留 2 等）。

---

## 二、账户管理 Tools

### `record_account` — 新增账户

**描述**：创建一个新的资金账户（银行卡/支付宝/现金等）

**输入参数**：

```typescript
{
  name: string;             // 账户名称，最长 50 字符，必填
  type: enum;               // checking | savings | alipay | wechat | credit_card | investment | cash | other
  initial_balance: number;  // 初始余额，默认 0，单位：元
  currency: string;         // 货币代码，默认 "CNY"
  note?: string;            // 备注，最长 200 字符，可选
}
```

**输出**：

```typescript
{
  success: boolean;
  account_id: string;       // UUID
  message: string;          // 如：账户「招商银行储蓄卡」已创建，初始余额 5000.00 元
}
```

---

### `update_account` — 编辑账户

**描述**：修改已有账户的信息

**输入参数**：

```typescript
{
  account_id: string;       // 账户 UUID，必填
  name?: string;
  note?: string;
}
```

---

### `delete_account` — 删除账户

**描述**：软删除账户（要求账户余额为 0 且无未删除交易，否则返回错误）

**输入参数**：

```typescript
{
  account_id: string;       // 账户 UUID，必填
  force?: boolean;          // 强制删除（同时软删除关联交易），默认 false
}
```

---

### `list_accounts` — 查询账户列表

**描述**：返回所有账户及实时余额，响应中包含净资产汇总（替代原 `get_net_worth`）

**输入参数**：

```typescript
{
  include_deleted?: boolean;  // 是否包含已删除账户，默认 false
  type?: string;              // 按类型过滤
}
```

**输出**：

```typescript
{
  accounts: Array<{
    account_id: string;
    name: string;
    type: string;
    balance: number;          // 实时余额
    currency: string;
    created_at: string;
  }>;
  summary: {
    total_assets: number;     // 所有正余额账户之和
    total_liabilities: number; // 信用卡等负债账户余额之和
    net_worth: number;        // 净资产 = total_assets - total_liabilities
  };
}
```

---

### `adjust_account_balance` — 余额校正

**描述**：手动校正账户余额（与实际银行账单对账时使用），会自动生成一条「余额调整」系统交易记录

**输入参数**：

```typescript
{
  account_id: string;       // 账户 UUID，必填
  actual_balance: number;   // 实际余额，必填
  note?: string;            // 校正原因说明
}
```

---

## 三、交易记录 Tools

### `record_transaction` — 记录单条交易

**描述**：记录一笔收入或支出。支持精确到秒的时间戳。写入后自动检查分类预算并附带预警信息。`tag_labels` 为结构化标签对象，每个维度最多选 1 个值；若不传某维度则为空，Server 端会根据规则在响应中返回 `suggested_tag_labels` 供 AI 客户端参考后补写。

**输入参数**：

```typescript
{
  type: enum;               // income | expense | transfer
  amount: number;           // 金额，正数，最多 2 位小数，必填
  category_id?: string;     // 分类 UUID（transfer 类型可不填）
  account_id: string;       // 来源账户 UUID，必填
  to_account_id?: string;   // 目标账户（仅 transfer 类型需要）
  occurred_at?: string;     // 交易时间，格式 "YYYY-MM-DD HH:mm:ss"，默认当前时间
  note?: string;            // 备注说明，最长 500 字符
  tag_labels?: {            // 结构化标签，每个维度 0 或 1 个值（仅 expense 有意义）
    method?: string;        // 消费方式：线上 | 线下 | 外卖
    behavior?: string;      // 消费行为：日常消费 | 冲动消费
    consumption_type?: string; // 消费类型：必选消费 | 可选消费
    scale?: string;         // 金额规模：大额支出 | 小额支出
    purpose?: string;       // 消费目的：生存必需 | 发展提升 | 享受休闲
  };
}
```

**输出**：

```typescript
{
  success: boolean;
  transaction_id: string;
  message: string;          // 如：已记录支出 38.00 元（餐饮/外卖），账户「支付宝」余额更新为 1,250.00 元
  budget_warning?: {        // 该分类预算使用超过 alert_threshold 时附带
    category: string;
    used_percent: number;
    remaining: number;
    status: "warning" | "exceeded";
  };
  suggested_tag_labels?: {  // Server 基于规则推断的建议标签（供 AI 客户端决策后回写）
    method?: string;
    behavior?: string;
    consumption_type?: string;
    scale?: string;
    purpose?: string;
  };
}
```

---

### `batch_record_transactions` — 批量自然语言录入

**描述**：从一段自然语言文本中识别并批量录入多条交易记录。原始文本保存在每条记录的 `source_text` 字段，支持事后溯源。AI 在解析时自动分配分类和标签。

**输入参数**：

```typescript
{
  raw_text: string;         // 原始自然语言文本，必填，最长 2000 字符
  account_id: string;       // 默认使用的账户 UUID，必填（单条可被文本中的账户描述覆盖）
  default_date?: string;    // 默认日期 "YYYY-MM-DD"，默认今天
  dry_run?: boolean;        // 仅解析预览，不写入数据库，默认 false
}
```

**输出**：

```typescript
{
  success: boolean;
  parsed_count: number;     // 识别到的交易条数
  transactions: Array<{
    transaction_id?: string;  // dry_run=true 时为 null
    type: string;
    amount: number;
    category_name: string;
    account_name: string;
    occurred_at: string;
    note: string;
    tag_labels: {             // 各维度标签（Server 规则推断 + AI 补充后的合并结果）
      method?: string;
      behavior?: string;
      consumption_type?: string;
      scale?: string;
      purpose?: string;
    };
    source_text: string;    // 对应的原始文本片段
  }>;
  failed_segments?: string[]; // 无法解析的文本片段（如有）
  budget_warnings?: Array<{   // 有分类预算超标时附带
    category: string;
    used_percent: number;
    status: "warning" | "exceeded";
  }>;
}
```

---

### `update_transaction` — 编辑交易记录

**描述**：修改已有交易记录，修改前后均记录审计日志

**输入参数**：

```typescript
{
  transaction_id: string;   // 交易 UUID，必填
  amount?: number;
  category_id?: string;
  account_id?: string;
  occurred_at?: string;     // 格式 "YYYY-MM-DD HH:mm:ss"
  note?: string;
  tag_labels?: {            // 传入则整体覆盖，未传的维度保持原值
    method?: string | null;
    behavior?: string | null;
    consumption_type?: string | null;
    scale?: string | null;
    purpose?: string | null;
  };
}
```

---

### `delete_transaction` — 删除交易记录

**描述**：软删除一条交易记录，同时回滚账户余额影响

**输入参数**：

```typescript
{
  transaction_id: string;   // 交易 UUID，必填
  reason?: string;          // 删除原因，用于审计日志
}
```

---

### `list_transactions` — 查询交易列表

**描述**：多条件过滤查询交易记录列表。当传入 `transaction_id` 时，返回该条记录的完整详情（含修改历史）。

**输入参数**：

```typescript
{
  transaction_id?: string;  // 指定单条 ID 查询（与其他过滤条件互斥）
  include_history?: boolean; // 单条查询时：是否返回修改历史，默认 false
  start_date?: string;      // 开始日期 "YYYY-MM-DD"
  end_date?: string;        // 结束日期 "YYYY-MM-DD"
  type?: enum;              // income | expense | transfer | all，默认 all
  category_id?: string;
  account_id?: string;
  min_amount?: number;
  max_amount?: number;
  keyword?: string;         // 备注关键词搜索
  tag_filter?: {            // 按标签维度过滤（各维度间 AND 逻辑）
    method?: string;
    behavior?: string;
    consumption_type?: string;
    scale?: string;
    purpose?: string;
  };
  page?: number;            // 默认 1
  page_size?: number;       // 默认 50，最大 200
  order?: enum;             // date_desc | date_asc | amount_desc | amount_asc，默认 date_desc
}
```

**输出**：返回记录列表、总数、当页收支汇总金额

---

## 四、分类管理 Tools

### `list_categories` — 查询分类列表

**输入参数**：

```typescript
{
  type?: enum;               // income | expense | all，默认 all
  include_hidden?: boolean;  // 是否包含隐藏分类，默认 false
}
```

**输出**：含父子关系的两级分类树结构

---

### `record_category` — 新增自定义分类

**输入参数**：

```typescript
{
  name: string;              // 分类名，最长 30 字符，必填
  type: enum;                // income | expense，必填
  parent_id?: string;        // 父分类 UUID（创建二级子分类时必填；不传则创建一级分类）
  icon?: string;             // emoji 图标字符
  color?: string;            // HEX 颜色
}
```

> 约束：`parent_id` 指向的分类本身不能已有父分类（限制最多 2 级）。

---

### `update_category` — 编辑分类

**描述**：修改分类信息，同时支持通过 `hidden` 字段控制分类的隐藏/显示状态（替代原 `toggle_category_visibility`）

**输入参数**：

```typescript
{
  category_id: string;       // 必填
  name?: string;
  icon?: string;
  color?: string;
  hidden?: boolean;          // true=隐藏，false=显示（仅预设分类需要此操作）
}
```

---

### `delete_category` — 删除自定义分类

**描述**：仅能删除用户自建分类，预设分类只能隐藏。若该分类下有未删除交易，需先指定替换分类。

**输入参数**：

```typescript
{
  category_id: string;
  replace_category_id?: string; // 该分类下的交易将迁移至此分类
}
```

---

## 五、预算管理 Tools

### `set_category_budget` — 设置分类预算

**输入参数**：

```typescript
{
  category_id: string;       // 必填
  amount: number;            // 月度预算金额，必填
  year_month: string;        // 格式 "2026-03"，默认当月
  alert_threshold?: number;  // 预警阈值百分比 0-100，默认 80
  recurring?: boolean;       // 是否每月自动延续，默认 true
}
```

---

### `get_budget_status` — 查询预算执行状态

**描述**：返回指定月份各分类的预算执行情况

**输入参数**：

```typescript
{
  year_month?: string;       // 格式 "2026-03"，默认当月
}
```

**输出**：

```typescript
{
  year_month: string;
  categories: Array<{
    category_id: string;
    category_name: string;
    parent_category_name?: string; // 二级分类时显示父分类名
    budget: number;
    spent: number;
    remaining: number;
    used_percent: number;
    status: "normal" | "warning" | "exceeded" | "no_budget";
  }>;
  unbudgeted_spend: number;  // 无预算分类的总支出
}
```

---

## 六、分析报表 Tools

### `analyze_monthly_summary` — 月度收支汇总

**输入参数**：

```typescript
{
  year_month?: string;           // 默认当月，格式 "2026-03"
  account_id?: string;           // 按账户过滤（可选）
  include_budget_comparison?: boolean; // 是否附带预算执行对比，默认 false
  include_amortized?: boolean;   // 是否使用分摊后金额计算支出，默认 true
}
```

**输出**：总收入、总支出、净结余、按分类细分支出、与上月对比，可选附带预算对比数据

---

### `analyze_yearly_summary` — 年度收支汇总

**输入参数**：

```typescript
{
  year?: number;             // 默认当年
}
```

**输出**：全年总收入/支出/结余，12 个月的月度明细对比，支出最多的分类 Top 5

---

### `analyze_category_trend` — 分类支出趋势

**输入参数**：

```typescript
{
  category_id: string;       // 必填
  months?: number;           // 分析最近 N 个月，默认 6，最大 24
}
```

**输出**：每月该分类的支出金额趋势，环比变化率

---

### `analyze_budget_report` — 预算执行报告

**描述**：对指定月份的预算执行情况做完整分析，适合月末复盘

**输入参数**：

```typescript
{
  year_month?: string;       // 默认当月
}
```

**输出**：各分类预算对比数据、超支/节余汇总、AI 文字建议

---

### `analyze_spending_pattern` — 消费习惯分析

**描述**：分析消费的时间分布、频率特征、高频商户/场景

**输入参数**：

```typescript
{
  start_date?: string;
  end_date?: string;
  category_id?: string;      // 可聚焦特定分类
}
```

---

### `analyze_top_expenses` — Top N 支出查询

**输入参数**：

```typescript
{
  start_date?: string;
  end_date?: string;
  top_n?: number;            // 默认 10，最大 50
  category_id?: string;
  account_id?: string;
}
```

---

### `analyze_cash_flow` — 现金流分析

**描述**：按时间段展示资金流入/流出情况，识别资金高峰低谷期

**输入参数**：

```typescript
{
  period?: enum;             // daily | weekly | monthly，默认 monthly
  months?: number;           // 最近 N 个月，默认 3
  account_id?: string;
}
```

---

## 七、净资产 Tools

### `record_net_worth_snapshot` — 记录净资产快照

**描述**：手动触发一次净资产快照记录，建议每月初调用。当前净资产实时值通过 `list_accounts` 获取。

**输入参数**：

```typescript
{
  note?: string;             // 快照备注
}
```

---

### `analyze_net_worth_trend` — 净资产趋势分析

**输入参数**：

```typescript
{
  months?: number;           // 最近 N 个月快照，默认 12
}
```

---

## 八、投资记录 Tools

### `record_investment_account` — 创建投资账户

**输入参数**：

```typescript
{
  name: string;              // 如「富途牛牛」「支付宝基金」
  type: enum;                // stock | fund | crypto | bond | other
  currency?: string;         // 默认 CNY
  note?: string;
}
```

---

### `record_investment_transaction` — 记录投资交易

**输入参数**：

```typescript
{
  account_id: string;
  type: enum;                // buy | sell | dividend | fee
  asset_name: string;        // 品种名称，如「腾讯控股」「沪深300ETF」
  asset_code?: string;       // 代码，如「00700」「510300」
  quantity?: number;
  price?: number;
  amount: number;            // 总金额（必填）
  date?: string;             // 默认今天
  note?: string;
}
```

---

### `list_investment_holdings` — 查询投资持仓

**输入参数**：

```typescript
{
  account_id?: string;       // 不填则查全部
}
```

---

### `update_investment_valuation` — 更新投资估值

**描述**：手动更新某投资账户的当前市值

**输入参数**：

```typescript
{
  account_id: string;
  current_value: number;
  valuation_date?: string;   // 默认今天
}
```

---

### `analyze_investment_return` — 投资收益分析

**输入参数**：

```typescript
{
  account_id?: string;       // 不填则分析全部
}
```

**输出**：总投入成本、当前估值、收益金额、收益率、年化收益率（如数据足够）

---

## 九、订阅管理 Tools

### `record_subscription` — 新增订阅

**描述**：记录一个周期性订阅服务的扣费信息

**输入参数**：

```typescript
{
  name: string;              // 订阅名称，如「Netflix」「ChatGPT Plus」，必填
  amount: number;            // 每期扣费金额，必填
  cycle: enum;               // monthly | quarterly | yearly | weekly，必填
  account_id: string;        // 扣费账户 UUID，必填
  category_id?: string;      // 关联分类（如「通讯/软件订阅」）
  next_billing_date: string; // 下次扣费日期 "YYYY-MM-DD"，必填
  auto_renew?: boolean;      // 是否自动续费，默认 true
  note?: string;
}
```

**输出**：

```typescript
{
  success: boolean;
  subscription_id: string;
  message: string;           // 如：已记录订阅「Netflix」，每月 68.00 元，下次扣费：2026-04-08
}
```

---

### `update_subscription` — 编辑/取消订阅

**描述**：修改订阅信息，或将状态设为「已取消」

**输入参数**：

```typescript
{
  subscription_id: string;   // 必填
  name?: string;
  amount?: number;
  cycle?: enum;
  account_id?: string;
  category_id?: string;
  next_billing_date?: string;
  auto_renew?: boolean;
  status?: enum;             // active | cancelled | paused
  note?: string;
}
```

---

### `list_subscriptions` — 查询订阅列表

**描述**：返回所有订阅，高亮展示近期即将扣费的订阅

**输入参数**：

```typescript
{
  status?: enum;             // active | cancelled | paused | all，默认 active
  upcoming_days?: number;    // 高亮展示 N 天内到期的订阅，默认 7
}
```

**输出**：

```typescript
{
  subscriptions: Array<{
    subscription_id: string;
    name: string;
    amount: number;
    cycle: string;
    account_name: string;
    category_name?: string;
    next_billing_date: string;
    days_until_billing: number;  // 距下次扣费天数
    is_upcoming: boolean;        // 是否在 upcoming_days 范围内
    status: string;
    annual_cost: number;         // 折算年费（便于对比）
  }>;
  monthly_total: number;         // 所有活跃订阅折算月费总计
  upcoming_charges: Array<{      // 近期即将扣费明细
    name: string;
    amount: number;
    billing_date: string;
  }>;
}
```

---

## 十、财务分摊 Tools

### `record_amortization` — 创建财务分摊计划

**描述**：将一笔已有的大额交易按月分摊，使月度报告更平滑地反映消费。原始交易记录和账户余额不变；分析报告中使用分摊月金额。

**输入参数**：

```typescript
{
  transaction_id: string;    // 要分摊的交易 UUID，必填（该交易 type 必须为 expense）
  start_month: string;       // 分摊起始月，格式 "2026-03"，必填
  total_months: number;      // 总摊销月数，最少 2 个月，必填
  note?: string;
}
```

**输出**：

```typescript
{
  success: boolean;
  amortization_id: string;
  monthly_amount: number;    // 每月分摊金额（total_amount / total_months，保留 2 位小数）
  schedule: Array<{          // 分摊计划预览
    month: string;
    amount: number;
  }>;
  message: string;           // 如：已为「房租 9000.00 元」创建 3 个月分摊计划，每月 3000.00 元
}
```

---

### `update_amortization` — 编辑/取消分摊计划

**描述**：修改分摊参数或终止分摊计划。取消后，已过去月份的分摊保留，剩余月份不再分摊。

**输入参数**：

```typescript
{
  amortization_id: string;   // 必填
  total_months?: number;     // 修改总摊销月数（不能少于已摊销月数）
  status?: enum;             // active | cancelled
  note?: string;
}
```

---

### `list_amortizations` — 查询分摊计划列表

**输入参数**：

```typescript
{
  status?: enum;             // active | cancelled | completed | all，默认 active
  year_month?: string;       // 查询指定月份有哪些分摊计划生效
}
```

**输出**：

```typescript
{
  amortizations: Array<{
    amortization_id: string;
    transaction_note: string;    // 原始交易备注
    total_amount: number;        // 原始总金额
    monthly_amount: number;      // 每月分摊额
    start_month: string;
    end_month: string;
    total_months: number;
    elapsed_months: number;      // 已分摊月数
    remaining_months: number;
    status: string;
  }>;
}
```

---

## 十一、标签 Tools

### `list_tags` — 查询标签体系与使用统计

**描述**：返回完整的结构化标签体系（维度 + 各维度下的预设值），同时附带每个标签值的历史使用频次。供 AI 客户端在打标签时确认可选值，不得传入体系外的值。

**输入参数**：无（全量返回标签体系）

**输出**：

```typescript
{
  dimensions: Array<{
    key: string;             // 维度标识：method | behavior | consumption_type | scale | purpose
    label: string;           // 维度中文名：消费方式 | 消费行为 | 消费类型 | 金额规模 | 消费目的
    description: string;     // 维度说明，供 AI 理解何时使用该维度
    values: Array<{
      value: string;         // 标签值，如「线上」「冲动消费」
      description: string;   // 该标签的判断说明
      usage_count: number;   // 历史使用次数
      last_used_at?: string; // 最近一次使用时间
    }>;
  }>;
}
```

**预设标签体系**（Server 端固定维护，`is_preset = true` 的值不可删除）：

| 维度 key | 维度名称 | 预设值 | 判断说明 |
|---|---|---|---|
| `method` | 消费方式 | 线上 | 通过 App/网页/小程序完成支付 |
| `method` | 消费方式 | 线下 | 到店实体消费、刷卡/现金 |
| `method` | 消费方式 | 外卖 | 通过外卖平台下单配送到家 |
| `behavior` | 消费行为 | 日常消费 | 规律性、计划内的日常开销 |
| `behavior` | 消费行为 | 冲动消费 | 非计划、受情绪/促销驱动的消费 |
| `consumption_type` | 消费类型 | 必选消费 | 无法回避的刚性支出（房租/交通/基本餐饮/医疗）|
| `consumption_type` | 消费类型 | 可选消费 | 可推迟或放弃的弹性支出（娱乐/购物/旅行）|
| `scale` | 金额规模 | 大额支出 | 金额超过个人设定阈值（默认 500 元）|
| `scale` | 金额规模 | 小额支出 | 金额低于个人设定阈值（默认 500 元）|
| `purpose` | 消费目的 | 生存必需 | 维持基本生活所需（食物/住房/医疗/基础交通）|
| `purpose` | 消费目的 | 发展提升 | 投资自身成长（教育/技能/职业/健身）|
| `purpose` | 消费目的 | 享受休闲 | 提升生活品质和娱乐体验（旅行/外出就餐/游戏/电影）|

---

## 十二、审计日志 Tools

### `list_audit_logs` — 查询操作日志 / 变更历史

**描述**：查询操作日志。当传入 `resource_id` 时，返回该条记录的完整修改历史（替代原 `get_change_history`）。

**输入参数**：

```typescript
{
  resource_id?: string;      // 指定资源 ID：返回该记录的全部变更历史（含修改前后字段对比）
  resource_type?: string;    // transaction | account | category | budget | subscription | amortization
  start_date?: string;
  end_date?: string;
  action?: enum;             // create | update | delete | restore
  page?: number;
  page_size?: number;        // 默认 20
}
```

---

### `restore_deleted_record` — 恢复已删除记录

**描述**：从软删除中恢复任意类型的记录（含原 `restore_transaction` 功能）

**输入参数**：

```typescript
{
  resource_type: string;     // transaction | account | category | ...
  resource_id: string;
}
```

---

## 十三、通用响应格式

### 成功响应

```typescript
{
  success: true;
  data: { ... };             // 具体数据
  message?: string;          // 人类可读的操作结果描述
}
```

### 错误响应

```typescript
{
  success: false;
  error: {
    code: string;            // VALIDATION_ERROR | NOT_FOUND | BUDGET_EXCEEDED | CATEGORY_DEPTH_EXCEEDED | ...
    message: string;         // 人类可读错误信息（中文）
    details?: unknown;       // 可选，校验错误详情
  }
}
```

### 分页响应

```typescript
{
  success: true;
  data: {
    items: Array<...>;
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    }
  }
}
```
