import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseDate, formatDate, toLunarDate } from '../js/date-utils.js';

describe('date-utils', () => {
  describe('parseDate', () => {
    it('应该正确解析标准日期格式 (本地时区)', () => {
      const result = parseDate('2024-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // 月份从0开始
      expect(result.getDate()).toBe(15);
    });

    it('应该处理 Excel 数字格式日期', () => {
      // Excel 日期：2024-01-01 对应的序列号
      const result = parseDate('45290');
      expect(result).toBeInstanceOf(Date);
    });

    it('应该处理空值', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
      expect(parseDate('')).toBeNull();
    });

    it('应该处理无效日期', () => {
      expect(parseDate('invalid')).toBeNull();
    });
  });

  describe('formatDate', () => {
    it('应该正确格式化日期', () => {
      const date = new Date(2024, 0, 15);
      const result = formatDate(date, 'solar');
      expect(result).toBe('2024年01月15日');
    });

    it('应该处理空值', () => {
      expect(formatDate(null, 'solar')).toBe('');
      expect(formatDate(undefined, 'solar')).toBe('');
    });

    it('none 选项应该返回空字符串', () => {
      const date = new Date(2024, 0, 15);
      expect(formatDate(date, 'none')).toBe('');
    });
  });

  describe('toLunarDate', () => {
    it('应该返回农历字符串', () => {
      const date = new Date(2024, 0, 1);
      const result = toLunarDate(date);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('无效日期应该返回空字符串', () => {
      const result = toLunarDate(null);
      expect(result).toBe('');
    });
  });
});
