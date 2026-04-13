import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGenderIcon, getChildOrderLabel } from '../js/tree-generator.js';

describe('tree-generator - 纯函数测试', () => {
  describe('getGenderIcon', () => {
    it('应该返回男性图标', () => {
      const html = getGenderIcon('男');
      expect(html).toContain('gender-male');
      expect(html).toContain('svg');
    });

    it('应该返回女性图标', () => {
      const html = getGenderIcon('女');
      expect(html).toContain('gender-female');
    });

    it('未知性别应该返回默认图标', () => {
      const html = getGenderIcon('其他');
      expect(html).toContain('gender-unknown');
    });

    it('空值应该返回未知图标', () => {
      const html = getGenderIcon('');
      expect(html).toContain('gender-unknown');
    });
  });

  describe('getChildOrderLabel', () => {
    it('应该返回序号 1', () => {
      const html = getChildOrderLabel(0);
      expect(html).toContain('1');
    });

    it('应该正确处理索引', () => {
      const html = getChildOrderLabel(2);
      expect(html).toContain('3');
    });

    it('应该包含 title 属性', () => {
      const html = getChildOrderLabel(0);
      expect(html).toContain('title=');
    });
  });
});
