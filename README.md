# 家族族谱生成器

这是一个基于 Web 的家族族谱生成器，允许用户通过上传 Excel 文件来创建和可视化家族关系。

## 功能特点

- ✅ 支持从 Excel 文件导入家族数据
- ✅ 提供多种族谱样式（垂直、水平、经典、树形图）
- ✅ 支持公历和农历日期显示
- ✅ 可导出为 PNG 图片或 PDF 文档
- ✅ 响应式设计，支持搜索和筛选人物

## 快速开始

### 环境要求
- Node.js ≥ 18
- npm ≥ 9

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
访问 http://localhost:5173

### 构建生产版本
```bash
npm run build
```
输出到 `dist/` 目录

### 运行测试
```bash
npm test
```

## 数据格式

上传的 Excel 文件应包含以下列（列名必须一致）：
| 列名 | 说明 | 示例 |
|------|------|------|
| 人物ID | 唯一标识 | 1 |
| 姓名 | 人物姓名 | 张三 |
| 性别 | 男/女 | 男 |
| 父亲ID | 指向父亲人物ID | 2 |
| 母亲ID | 指向母亲人物ID | 3 |
| 配偶ID | 指向配偶人物ID（可多个，逗号分隔） | 4,5 |
| 出生日期 | 日期字符串 | 1950-01-01 |
| 死亡日期 | 日期字符串（可选） | 2020-12-31 |

## 项目结构

```
├── index.html          # 主页面
├── package.json        # 项目配置
├── vitest.config.js    # 测试配置
├── CLAUDE.md           # 代码审查与改进任务说明
├── css/                # 样式文件
│   ├── main.css
│   ├── vertical-style.css
│   ├── horizontal-style.css
│   ├── classic-style.css
│   └── tree-style.css
├── js/                 # JavaScript 源代码
│   ├── core.js         # 核心逻辑（事件、导出）
│   ├── tree-generator.js # 族谱树生成算法
│   ├── date-utils.js   # 日期处理工具
│   ├── sample-data.js  # 示例数据
│   ├── xlsx.full.min.js
│   ├── html2canvas.min.js
│   ├── lunar.js
│   └── jspdf.umd.min.js # 本地备份（CDN 失效时使用）
├── tests/              # 测试文件
│   ├── setup.js
│   ├── date-utils.test.js
│   └── tree-generator.test.js
└── dist/               # 构建输出（生成）
```

## 技术栈

- **前端**: 原生 HTML5 + CSS3 + JavaScript (ES6+)
- **构建工具**: Vite 6
- **测试框架**: Vitest + jsdom
- **库**:
  - XLSX: Excel 文件解析
  - html2canvas: DOM 截图
  - jsPDF: PDF 生成
  - lunar-javascript: 农历转换

## 贡献指南

欢迎提交 Issue 和 Pull Request。

### 开发规范
- 遵循现有的代码风格
- 新增功能需包含测试
- 确保 `npm test` 通过

### 提交信息格式
```
feat: 添加某某功能
fix: 修复某个 bug
docs: 更新文档
test: 增加测试
chore: 构建/工具链更新
```

## License

MIT