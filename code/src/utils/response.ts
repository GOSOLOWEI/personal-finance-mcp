export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: true;
  data: {
    items: T[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    };
  };
}

export function successResponse<T>(data: T, message?: string): SuccessResponse<T> {
  return { success: true, data, message };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    },
  };
}

/**
 * 将数字字符串格式化为保留2位小数的字符串
 * Drizzle ORM 从 PostgreSQL NUMERIC 类型返回字符串
 */
export function formatAmount(value: string | null | undefined): number {
  if (value == null) return 0;
  return parseFloat(parseFloat(value).toFixed(2));
}

/**
 * 将 UTC 时间转换为北京时间字符串（Asia/Shanghai，格式：YYYY-MM-DD HH:mm:ss）
 */
export function formatDateTimeCST(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\//g, '-');
}
