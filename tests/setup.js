// 测试环境设置
import { vi } from 'vitest';

// Mock window.jspdf (如果未加载)
vi.stubGlobal('jspdf', {
  jsPDF: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    save: vi.fn(),
  })),
});

// Mock html2canvas
vi.stubGlobal('html2canvas', vi.fn().mockResolvedValue({
  toDataURL: () => 'data:image/png;base64,test',
}));

// Mock XLSX
vi.stubGlobal('XLSX', {
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
  },
});

// Mock Lunar
vi.stubGlobal('Lunar', {
  fromDate: vi.fn().mockReturnValue({
    getYear: () => 2024,
    getMonth: () => 1,
    getDay: () => 1,
    getChineseYear: () => '甲辰',
    getChineseMonth: () => '正月',
    getChineseDay: () => '初一',
  }),
});
