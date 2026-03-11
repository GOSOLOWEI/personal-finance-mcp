import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, categories, tagDefinitions } from './schema.js';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function seedTagDefinitions() {
  console.log('Seeding tag definitions...');

  const tags = [
    // 消费方式
    { dimension: 'method', dimensionLabel: '消费方式', value: '线上', description: '通过 App/网页/小程序完成支付', sortOrder: 1 },
    { dimension: 'method', dimensionLabel: '消费方式', value: '线下', description: '到店实体消费，刷卡/扫码/现金', sortOrder: 2 },
    { dimension: 'method', dimensionLabel: '消费方式', value: '外卖', description: '通过外卖平台下单配送到家', sortOrder: 3 },
    // 消费行为
    { dimension: 'behavior', dimensionLabel: '消费行为', value: '日常消费', description: '规律性、计划内的日常开销', sortOrder: 1 },
    { dimension: 'behavior', dimensionLabel: '消费行为', value: '冲动消费', description: '非计划、受情绪/促销驱动的消费', sortOrder: 2 },
    // 消费类型
    { dimension: 'consumption_type', dimensionLabel: '消费类型', value: '必选消费', description: '无法回避的刚性支出（房租/交通/基本餐饮/医疗）', sortOrder: 1 },
    { dimension: 'consumption_type', dimensionLabel: '消费类型', value: '可选消费', description: '可推迟或放弃的弹性支出（娱乐/购物/旅行）', sortOrder: 2 },
    // 金额规模
    { dimension: 'scale', dimensionLabel: '金额规模', value: '大额支出', description: '金额 ≥ 500 元（阈值可通过配置调整）', sortOrder: 1 },
    { dimension: 'scale', dimensionLabel: '金额规模', value: '小额支出', description: '金额 < 500 元', sortOrder: 2 },
    // 消费目的
    { dimension: 'purpose', dimensionLabel: '消费目的', value: '生存必需', description: '维持基本生活所需（食物/住房/医疗/基础交通）', sortOrder: 1 },
    { dimension: 'purpose', dimensionLabel: '消费目的', value: '发展提升', description: '投资自身成长（教育/技能/职业/健身）', sortOrder: 2 },
    { dimension: 'purpose', dimensionLabel: '消费目的', value: '享受休闲', description: '提升生活品质和娱乐体验（旅行/外出就餐/游戏/电影）', sortOrder: 3 },
  ];

  for (const tag of tags) {
    await db.insert(tagDefinitions).values(tag).onConflictDoNothing();
  }

  console.log(`Seeded ${tags.length} tag definitions`);
}

async function seedCategories(userId: string) {
  console.log('Seeding preset categories...');

  // 一级分类（收入）
  const incomeParents = [
    { name: '职业收入', type: 'income', groupLabel: '收入', icon: '💼', sortOrder: 1 },
    { name: '投资理财收入', type: 'income', groupLabel: '收入', icon: '📈', sortOrder: 2 },
    { name: '其他收入', type: 'income', groupLabel: '收入', icon: '💵', sortOrder: 3 },
    { name: '往来收入', type: 'income', groupLabel: '往来', icon: '🔄', isHidden: true, sortOrder: 4 },
  ] as const;

  // 一级分类（支出）
  const expenseParents = [
    { name: '住房', type: 'expense', groupLabel: '必要生活', icon: '🏠', sortOrder: 1 },
    { name: '餐饮', type: 'expense', groupLabel: '必要生活', icon: '🍜', sortOrder: 2 },
    { name: '交通', type: 'expense', groupLabel: '必要生活', icon: '🚗', sortOrder: 3 },
    { name: '生活缴费', type: 'expense', groupLabel: '必要生活', icon: '💡', sortOrder: 4 },
    { name: '医疗健康', type: 'expense', groupLabel: '健康成长', icon: '🏥', sortOrder: 5 },
    { name: '学习进修', type: 'expense', groupLabel: '健康成长', icon: '📚', sortOrder: 6 },
    { name: '家居日用品', type: 'expense', groupLabel: '家庭生活', icon: '🏡', sortOrder: 7 },
    { name: '耐用消费品', type: 'expense', groupLabel: '家庭生活', icon: '📱', sortOrder: 8 },
    { name: '赡养抚养', type: 'expense', groupLabel: '家庭生活', icon: '👨‍👩‍👧', isHidden: true, sortOrder: 9 },
    { name: '形象管理', type: 'expense', groupLabel: '品质社交', icon: '👗', sortOrder: 10 },
    { name: '休闲娱乐', type: 'expense', groupLabel: '品质社交', icon: '🎮', sortOrder: 11 },
    { name: '兴趣爱好', type: 'expense', groupLabel: '品质社交', icon: '🏃', sortOrder: 12 },
    { name: '人情社交', type: 'expense', groupLabel: '品质社交', icon: '🎁', sortOrder: 13 },
    { name: '旅行', type: 'expense', groupLabel: '品质社交', icon: '✈️', sortOrder: 14 },
    { name: '资产购置', type: 'expense', groupLabel: '金融往来', icon: '💰', isHidden: true, countInStats: false, sortOrder: 15 },
    { name: '债务管理', type: 'expense', groupLabel: '金融往来', icon: '💳', isHidden: true, countInStats: false, sortOrder: 16 },
    { name: '意外支出', type: 'expense', groupLabel: '杂项', icon: '📦', sortOrder: 17 },
  ] as const;

  const parentMap: Record<string, string> = {};

  // 插入一级分类
  for (const parent of [...incomeParents, ...expenseParents]) {
    const [inserted] = await db
      .insert(categories)
      .values({
        userId,
        name: parent.name,
        type: parent.type,
        groupLabel: parent.groupLabel,
        icon: parent.icon,
        isPreset: true,
        isHidden: ('isHidden' in parent ? parent.isHidden : false) as boolean,
        countInStats: ('countInStats' in parent ? parent.countInStats : true) as boolean,
        sortOrder: parent.sortOrder,
      })
      .onConflictDoNothing()
      .returning({ id: categories.id, name: categories.name });

    if (inserted) {
      parentMap[parent.name] = inserted.id;
    } else {
      // 已存在，查询 ID
      const existing = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, parent.name))
        .limit(1);
      if (existing[0]) parentMap[parent.name] = existing[0].id;
    }
  }

  // 二级分类数据
  const childCategories = [
    // 职业收入
    { parent: '职业收入', name: '工资', type: 'income', sortOrder: 1 },
    { parent: '职业收入', name: '奖金', type: 'income', sortOrder: 2 },
    { parent: '职业收入', name: '津贴', type: 'income', sortOrder: 3 },
    { parent: '职业收入', name: '兼职', type: 'income', sortOrder: 4 },
    // 投资理财收入
    { parent: '投资理财收入', name: '存款利息', type: 'income', sortOrder: 1 },
    { parent: '投资理财收入', name: '理财产品收益', type: 'income', sortOrder: 2 },
    { parent: '投资理财收入', name: '分红', type: 'income', sortOrder: 3 },
    // 其他收入
    { parent: '其他收入', name: '退税', type: 'income', sortOrder: 1 },
    { parent: '其他收入', name: '二手变卖', type: 'income', sortOrder: 2 },
    { parent: '其他收入', name: '报销款', type: 'income', sortOrder: 3 },
    { parent: '其他收入', name: '保险赔付', type: 'income', sortOrder: 4 },
    // 往来收入（隐藏，不计入统计）
    { parent: '往来收入', name: '收还款', type: 'income', isHidden: true, countInStats: false, sortOrder: 1 },
    { parent: '往来收入', name: '收垫付款', type: 'income', isHidden: true, countInStats: false, sortOrder: 2 },
    { parent: '往来收入', name: '人情回礼', type: 'income', isHidden: true, countInStats: false, sortOrder: 3 },
    // 住房
    { parent: '住房', name: '房租', type: 'expense', sortOrder: 1 },
    { parent: '住房', name: '物业费', type: 'expense', sortOrder: 2 },
    { parent: '住房', name: '维修/安装', type: 'expense', sortOrder: 3 },
    { parent: '住房', name: '房贷', type: 'expense', sortOrder: 4 },
    // 餐饮
    { parent: '餐饮', name: '食材', type: 'expense', sortOrder: 1 },
    { parent: '餐饮', name: '堂食', type: 'expense', sortOrder: 2 },
    { parent: '餐饮', name: '外卖', type: 'expense', sortOrder: 3 },
    { parent: '餐饮', name: '饮料', type: 'expense', sortOrder: 4 },
    { parent: '餐饮', name: '纯净水', type: 'expense', sortOrder: 5 },
    // 交通
    { parent: '交通', name: '公共交通', type: 'expense', sortOrder: 1 },
    { parent: '交通', name: '打车', type: 'expense', sortOrder: 2 },
    { parent: '交通', name: '顺风车', type: 'expense', sortOrder: 3 },
    { parent: '交通', name: '加油', type: 'expense', isHidden: true, sortOrder: 4 },
    { parent: '交通', name: '高速费', type: 'expense', isHidden: true, sortOrder: 5 },
    { parent: '交通', name: '保养维修', type: 'expense', isHidden: true, sortOrder: 6 },
    { parent: '交通', name: '车险', type: 'expense', isHidden: true, sortOrder: 7 },
    // 生活缴费
    { parent: '生活缴费', name: '电费', type: 'expense', sortOrder: 1 },
    { parent: '生活缴费', name: '水费', type: 'expense', sortOrder: 2 },
    { parent: '生活缴费', name: '燃气费', type: 'expense', sortOrder: 3 },
    { parent: '生活缴费', name: '网费', type: 'expense', sortOrder: 4 },
    { parent: '生活缴费', name: '手机话费', type: 'expense', sortOrder: 5 },
    // 医疗健康
    { parent: '医疗健康', name: '门诊/挂号费', type: 'expense', sortOrder: 1 },
    { parent: '医疗健康', name: '药品', type: 'expense', sortOrder: 2 },
    { parent: '医疗健康', name: '体检', type: 'expense', sortOrder: 3 },
    { parent: '医疗健康', name: '牙科', type: 'expense', sortOrder: 4 },
    { parent: '医疗健康', name: '医疗保险', type: 'expense', sortOrder: 5 },
    { parent: '医疗健康', name: '保健品', type: 'expense', sortOrder: 6 },
    { parent: '医疗健康', name: '心理咨询', type: 'expense', isHidden: true, sortOrder: 7 },
    // 学习进修
    { parent: '学习进修', name: '课程/培训', type: 'expense', sortOrder: 1 },
    { parent: '学习进修', name: '书籍/资料', type: 'expense', sortOrder: 2 },
    { parent: '学习进修', name: '考试报名费', type: 'expense', sortOrder: 3 },
    { parent: '学习进修', name: '工具软件', type: 'expense', sortOrder: 4 },
    // 家居日用品
    { parent: '家居日用品', name: '纸巾/洗护', type: 'expense', sortOrder: 1 },
    { parent: '家居日用品', name: '厨房用具', type: 'expense', sortOrder: 2 },
    { parent: '家居日用品', name: '家装工具', type: 'expense', sortOrder: 3 },
    // 耐用消费品
    { parent: '耐用消费品', name: '大家电', type: 'expense', sortOrder: 1 },
    { parent: '耐用消费品', name: '小家电', type: 'expense', sortOrder: 2 },
    { parent: '耐用消费品', name: '数码产品', type: 'expense', sortOrder: 3 },
    { parent: '耐用消费品', name: '家具', type: 'expense', sortOrder: 4 },
    // 赡养抚养（全部默认隐藏）
    { parent: '赡养抚养', name: '父母生活费', type: 'expense', isHidden: true, sortOrder: 1 },
    { parent: '赡养抚养', name: '子女学费', type: 'expense', isHidden: true, sortOrder: 2 },
    { parent: '赡养抚养', name: '子女兴趣班', type: 'expense', isHidden: true, sortOrder: 3 },
    { parent: '赡养抚养', name: '子女零花钱', type: 'expense', isHidden: true, sortOrder: 4 },
    { parent: '赡养抚养', name: '保姆/托育费', type: 'expense', isHidden: true, sortOrder: 5 },
    // 形象管理
    { parent: '形象管理', name: '衣裤鞋帽', type: 'expense', sortOrder: 1 },
    { parent: '形象管理', name: '箱包', type: 'expense', sortOrder: 2 },
    { parent: '形象管理', name: '护肤品', type: 'expense', sortOrder: 3 },
    { parent: '形象管理', name: '美容护理', type: 'expense', sortOrder: 4 },
    { parent: '形象管理', name: '理发', type: 'expense', sortOrder: 5 },
    // 休闲娱乐
    { parent: '休闲娱乐', name: '电影演出', type: 'expense', sortOrder: 1 },
    { parent: '休闲娱乐', name: '玩具游戏', type: 'expense', sortOrder: 2 },
    { parent: '休闲娱乐', name: '宠物开销', type: 'expense', isHidden: true, sortOrder: 3 },
    { parent: '休闲娱乐', name: '景区门票', type: 'expense', sortOrder: 4 },
    { parent: '休闲娱乐', name: '游戏充值', type: 'expense', sortOrder: 5 },
    // 兴趣爱好
    { parent: '兴趣爱好', name: '健身运动', type: 'expense', sortOrder: 1 },
    { parent: '兴趣爱好', name: '运动装备', type: 'expense', sortOrder: 2 },
    { parent: '兴趣爱好', name: '赛事报名', type: 'expense', sortOrder: 3 },
    { parent: '兴趣爱好', name: '音乐艺术', type: 'expense', sortOrder: 4 },
    { parent: '兴趣爱好', name: '户外运动', type: 'expense', sortOrder: 5 },
    { parent: '兴趣爱好', name: '其他爱好', type: 'expense', sortOrder: 6 },
    // 人情社交
    { parent: '人情社交', name: '聚餐请客', type: 'expense', sortOrder: 1 },
    { parent: '人情社交', name: '份子钱', type: 'expense', sortOrder: 2 },
    { parent: '人情社交', name: '节日送礼', type: 'expense', sortOrder: 3 },
    { parent: '人情社交', name: '孝敬红包', type: 'expense', sortOrder: 4 },
    // 旅行
    { parent: '旅行', name: '旅途交通', type: 'expense', sortOrder: 1 },
    { parent: '旅行', name: '住宿', type: 'expense', sortOrder: 2 },
    { parent: '旅行', name: '旅途餐饮', type: 'expense', sortOrder: 3 },
    { parent: '旅行', name: '景区门票', type: 'expense', sortOrder: 4 },
    { parent: '旅行', name: '旅行用品', type: 'expense', sortOrder: 5 },
    // 资产购置（count_in_stats=false，隐藏）
    { parent: '资产购置', name: '投资性黄金', type: 'expense', isHidden: true, countInStats: false, sortOrder: 1 },
    { parent: '资产购置', name: '收藏品', type: 'expense', isHidden: true, countInStats: false, sortOrder: 2 },
    // 债务管理（count_in_stats=false，隐藏）
    { parent: '债务管理', name: '信用卡还款', type: 'expense', isHidden: true, countInStats: false, sortOrder: 1 },
    { parent: '债务管理', name: '花呗/白条还款', type: 'expense', isHidden: true, countInStats: false, sortOrder: 2 },
    { parent: '债务管理', name: '借贷往来', type: 'expense', isHidden: true, countInStats: false, sortOrder: 3 },
    // 意外支出
    { parent: '意外支出', name: '快递费', type: 'expense', sortOrder: 1 },
    { parent: '意外支出', name: '捐赠', type: 'expense', sortOrder: 2 },
    { parent: '意外支出', name: '交通罚款', type: 'expense', sortOrder: 3 },
    { parent: '意外支出', name: '维修费', type: 'expense', sortOrder: 4 },
  ] as const;

  let inserted = 0;
  for (const child of childCategories) {
    const parentId = parentMap[child.parent];
    if (!parentId) {
      console.warn(`Parent category "${child.parent}" not found, skipping "${child.name}"`);
      continue;
    }

    await db
      .insert(categories)
      .values({
        userId,
        name: child.name,
        type: child.type,
        parentId,
        isPreset: true,
        isHidden: ('isHidden' in child ? child.isHidden : false) as boolean,
        countInStats: ('countInStats' in child ? child.countInStats : true) as boolean,
        sortOrder: child.sortOrder,
      })
      .onConflictDoNothing();

    inserted++;
  }

  console.log(`Seeded ${Object.keys(parentMap).length} parent categories and ${inserted} child categories`);
}

async function main() {
  console.log('Starting database seed...');

  // 创建默认用户
  const [existingUser] = await db.select().from(users).limit(1);
  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Using existing user: ${existingUser.username} (${userId})`);
  } else {
    const [newUser] = await db
      .insert(users)
      .values({ username: 'default', email: null })
      .returning({ id: users.id });
    userId = newUser.id;
    console.log(`Created default user: ${userId}`);
  }

  await seedTagDefinitions();
  await seedCategories(userId);

  console.log('Seed completed successfully!');
  await sql.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
