# 个人财务管理 MCP 服务

基于 **MCP（Model Context Protocol）** 标准构建的 AI 驱动个人财务管理服务，支持 Claude Desktop、Cursor IDE 等 AI 客户端通过自然语言进行财务管理。

## 功能特色

- 自然语言记账 — 在 AI 对话中直接描述消费，自动结构化录入
- 智能分析报表 — 月报/年报/趋势分析，支持自然语言查询
- 预算管理 — 分类预算 + 超支预警（使用率 ≥80% 自动触发）
- 订阅管理 — 追踪所有周期性订阅扣费，7 天内到期高亮提醒
- 财务分摊 — 大额支出按月分摊，月度报告更真实
- 净资产追踪 — 资产负债全景视图，支持历史快照趋势
- 投资记录 — 简化版投资组合跟踪
- 审计日志 — 所有操作可追溯，支持软删除恢复

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 运行时 | Node.js 22+ | LTS 版本 |
| 开发语言 | TypeScript 5.x | 严格模式，完整类型安全 |
| MCP SDK | `@modelcontextprotocol/sdk` | 官方 SDK |
| 数据库 | PostgreSQL 16+ | 远程托管，支持 JSON 字段 |
| ORM | Drizzle ORM | 轻量、类型安全 |
| 数据校验 | Zod | Tool 入参校验 |

## MCP Tools 概览

共 **39 个 Tools**，覆盖 11 个功能模块：

```
账户管理(5) · 交易记录(5) · 分类管理(4) · 预算管理(2)
分析报表(7) · 净资产(2) · 投资记录(5) · 订阅管理(3)
财务分摊(3) · 标签(1) · 审计日志(2)
```

## 快速开始

### 1. 准备 PostgreSQL 数据库

准备一个 PostgreSQL 16+ 数据库（可使用 Supabase、Neon、Railway 等托管服务）。

### 2. 安装依赖

```bash
cd code
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入数据库连接串
```

`.env` 示例：

```
DATABASE_URL="postgresql://username:password@host:5432/finance_db?sslmode=require"
```

### 4. 初始化数据库

```bash
# 生成迁移文件
npm run db:generate

# 执行迁移（创建所有表）
npm run db:migrate

# 插入预设分类种子数据（111 条分类 + 12 条标签定义）
npm run db:seed
```

### 5. 验证服务运行

```bash
npm run dev
```

输出 `Personal Finance MCP Server running on stdio (39 tools loaded)` 表示启动成功。

## 配置 Claude Desktop

编辑 Claude Desktop 配置文件：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "personal-finance": {
      "command": "node",
      "args": ["path/to/code/dist/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

构建后运行：

```bash
npm run build
```

## 配置 Cursor IDE

在 Cursor 设置中添加 MCP Server，命令为：

```bash
node /path/to/code/dist/server.js
```

或使用 `tsx` 直接运行源码（开发模式）：

```bash
npx tsx /path/to/code/src/server.ts
```

## 数据库管理

```bash
npm run db:studio    # 打开 Drizzle Studio 可视化界面
npm run db:generate  # 生成新的迁移文件
npm run db:migrate   # 执行迁移
npm run db:seed      # 重新插入种子数据
```

## 使用示例

在 Claude Desktop 或 Cursor 中，你可以这样使用：

**记账：**
> 今天用支付宝买了瑞幸咖啡 18 元，中午外卖 35 元

**查询：**
> 帮我看一下本月餐饮支出情况

**分析：**
> 给我一份本月收支汇总报告

**管理订阅：**
> 帮我记录一个 Netflix 订阅，每月 68 元，下次扣费是 4 月 8 日

## 开发文档

| 文档 | 说明 |
|---|---|
| [01-功能设计文档](./docs/01-功能设计文档.md) | 功能模块全览、架构设计 |
| [02-MCP-Tools规格](./docs/02-MCP-Tools规格.md) | 39 个 MCP Tools 完整入参/出参规格 |
| [03-数据库设计](./docs/03-数据库设计.md) | PostgreSQL 表结构、索引、视图设计 |
| [04-开发路线图](./docs/04-开发路线图.md) | 4 阶段开发计划与里程碑 |
| [实现计划](./docs/plans/2026-03-11-finance-mcp-service.md) | 详细编码实现计划 |

## 当前状态

> 阶段一~四全部完成 — 39 个 MCP Tools 已实现，TypeScript 编译通过
