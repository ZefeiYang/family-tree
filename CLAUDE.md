# Family Tree 代码审查与改进任务

## 项目概述
一个基于 Web 的家族族谱生成器，允许用户通过上传 Excel 文件创建和可视化家族关系。
技术栈：纯 HTML/CSS/JavaScript（前端框架：Vite）

## 当前代码结构
```
family-tree/
├── index.html           # 主页面
├── package.json         # 项目配置（scripts: dev, test）
├── css/
│   ├── main.css
│   ├── vertical-style.css
│   ├── horizontal-style.css
│   ├── classic-style.css
│   └── tree-style.css
├── js/
│   ├── core.js          # 核心逻辑（事件监听、文件处理、导出）
│   ├── tree-generator.js # 树形图生成算法
│   ├── date-utils.js    # 日期处理工具
│   ├── sample-data.js   # 示例数据
│   ├── xlsx.full.min.js # Excel 解析库（vendored）
│   ├── html2canvas.min.js
│   └── lunar.js         # 农历转换库
└── node_modules/
```

## 已知问题（需验证）
1. **依赖加载容错性差**：`core.js` 中依赖库使用全局变量（XLSX, html2canvas, Lunar），CDN 失败时无降级方案
2. **测试缺失**：`package.json` 中 test 脚本未配置，无单元测试
3. **导出功能可靠性**：
   - PDF 导出依赖 CDN 上的 jsPDF，可能加载失败
   - `createExportClone` 逻辑复杂，容易出错
4. **性能问题**：大数据集（几百人）时树渲染可能卡顿
5. **错误处理不完善**：Excel 解析失败时提示不够友好
6. **代码组织**：所有 JS 混在一起，无模块化
7. **可访问性**：缺少 ARIA 标签、键盘导航支持
8. **响应式设计**：未适配移动端

## 你的任务

### 阶段 1：代码审查与问题确认
- 运行项目（`npm run dev`）进行手动测试
- 识别所有潜在 bug 和代码坏味道
- 评估测试覆盖率（目前为 0）

### 阶段 2：架构改进
- **引入测试框架**：配置 Jest 或 Vitest，编写核心函数单元测试
  - 测试 `date-utils.js`（日期解析、格式化、农历转换）
  - 测试 `tree-generator.js`（树构建、排序、规模计算）
  - 测试 `core.js` 的导出逻辑（模拟 DOM）
- **模块化重构**：将 JS 文件转为 ES6 模块（可选，但建议）
- **增强错误处理**：
  - Excel 格式校验（列缺失、数据类型错误）
  - 添加用户友好的错误提示
- **优化导出**：
  - 本地化 jsPDF（添加到 dependencies 而非 CDN）
  - 改进 `createExportClone` 的稳定性
- **性能优化**：
  - 虚拟滚动或分页（超大型族谱）
  - 防抖文件上传处理

### 阶段 3：功能增强（可选）
- 添加导入/导出 JSON 功能（备份/恢复）
- 支持多人协作编辑（后端 + WebSocket，较大改动）
- 添加搜索/过滤人物功能
- 支持 GEDCOM 标准格式导入/导出

### 阶段 4：质量保障
- 配置 ESLint + Prettier
- 添加 CI（GitHub Actions）：运行测试、lint
- 更新 README（包含开发、测试、部署说明）

### 阶段 5：提交
- 分多个原子提交（feature + test + docs + ci）
- 确保测试通过
- 推送至远程仓库

## 预期产出
1. **测试覆盖率 ≥ 70%**（核心逻辑）
2. **无控制台错误**（生产环境）
3. **清晰的提交历史**
4. **更新的文档**

## 注意事项
- 保持向后兼容（不破坏现有 Excel 导入）
- 优先修复阻塞性 bug，其次优化
- 每次改动后手动验证 UI 效果

---

**请开始工作**：
1. 先审阅代码，列出所有问题
2. 与我确认改进计划
3. 逐步实现、测试、提交
