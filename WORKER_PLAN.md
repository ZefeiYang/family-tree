# Web Worker 后台解析 - 实施计划

> 创建：2026-04-13
> 状态：进行中
> 优先级：🟡 中
> 预估工时：6 小时

---

## 🎯 **目标**

- ✅ 将族谱树构建移至 Web Worker（不阻塞 UI）
- ✅ 大文件（>500 人）解析保持界面流畅
- ✅ 显示进度指示器
- ✅ 重构 buildTree 为纯函数（提升代码质量）

---

## 🏗️ **架构设计**

### 当前架构（单线程）
```
主线程：
  Excel 解析 → buildTree（递归生成 HTML）→ DOM 渲染
  ❌ 大文件时 UI 卡顿
```

### 新架构（Worker 分担计算）
```
主线程：            Web Worker：
  Excel 解析          buildTreePure() → 结构化数据
  sendMessage() →     (后台计算)
  receive result →    postMessage()
  渲染 DOM            ✅ 不阻塞 UI
```

---

## 📝 **详细步骤**

### 步骤 1：重构 `buildTree` 为 `buildTreePure`

**当前**：
```javascript
function buildTree(person, level, parentInfo) {
    let html = '';
    // ... 返回 HTML 字符串
    return html;
}
```

**改为**：
```javascript
function buildTreePure(person, level, parentInfo, allPersons) {
    // 返回结构化对象，不含 DOM 操作
    return {
        type: 'person',
        id: person.人物ID,
        name: person.姓名,
        gender: person.性别,
        birthDate: person.出生日期,
        deathDate: person.死亡日期,
        generation: level + 1,
        children: [] // 递归填充
    };
}
```

**好处**：
- 纯函数，易于测试
- 可在 Worker 中运行
- 主线程负责 `renderNodeToDOM(nodeData)` 生成 HTML

---

### 步骤 2：创建 `js/worker.js`

```javascript
// Web Worker - 后台计算族谱树结构
import { buildTreePure, calculateTreeSize } from './tree-generator.js';

self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    if (type === 'buildTree') {
        const { person, level, parentInfo, allPersons } = data;
        
        try {
            // 报告进度（开始）
            self.postMessage({ type: 'progress', stage: 'building', percent: 0 });
            
            // 构建树（纯函数）
            const treeData = buildTreePure(person, level, parentInfo, allPersons);
            
            // 报告进度（完成）
            self.postMessage({ type: 'progress', stage: 'complete', percent: 100 });
            
            // 返回结果
            self.postMessage({ type: 'treeBuilt', result: treeData });
        } catch (error) {
            self.postMessage({ type: 'error', message: error.message });
        }
    }
    
    if (type === 'calculateSize') {
        try {
            const { person, level, allPersons } = data;
            const size = calculateTreeSize(person, level, allPersons);
            self.postMessage({ type: 'sizeCalculated', size });
        } catch (error) {
            self.postMessage({ type: 'error', message: error.message });
        }
    }
};
```

---

### 步骤 3：修改 `core.js` - 集成 Worker

```javascript
// 全局变量
let treeWorker = null;

async function initWorker() {
    if (window.Worker) {
        treeWorker = new Worker('js/worker.js', { type: 'module' });
        
        treeWorker.onmessage = function(e) {
            const { type, result, size, stage, percent } = e.data;
            
            if (type === 'treeBuilt') {
                // Worker 计算完成，主线程渲染 DOM
                renderTreeFromData(result);
                hideLoading();
            }
            
            if (type === 'progress') {
                // 更新进度提示
                updateProgress(stage, percent);
            }
            
            if (type === 'error') {
                hideLoading();
                alert('Worker 错误: ' + result.message);
            }
        };
        
        treeWorker.onerror = function(error) {
            console.error('Worker 错误:', error);
            // 降级到主线程计算
            treeWorker = null;
        };
    }
}

// 修改 generateFamilyTree - 使用 Worker
async function generateFamilyTree(data, selectedRootId = null) {
    // ... 现有代码（创建 container、personMap 等）
    
    if (selectedRootId) {
        const selectedRoot = personMap[selectedRootId];
        
        if (treeWorker) {
            // 使用 Worker 后台计算
            showLoading('正在生成族谱（后台计算中）...');
            
            treeWorker.postMessage({
                type: 'buildTree',
                data: {
                    person: selectedRoot,
                    level: 0,
                    parentInfo: null,
                    allPersons: data
                }
            });
        } else {
            // 降级：主线程计算
            const rootNode = buildTree(selectedRoot, 0, null);
            // ... 渲染
        }
    }
}

// 新增：从 Worker 数据渲染 DOM
function renderTreeFromData(treeData) {
    const treeDiv = document.createElement('div');
    treeDiv.className = `family-tree ${selectedStyle}`;
    
    function renderNode(node) {
        // 将 node 对象转为 HTML 字符串（不依赖全局变量）
        // 类似于原来的 buildTree，但基于传入的 node 数据
    }
    
    treeDiv.innerHTML = renderNode(treeData);
    renderTarget.appendChild(treeDiv);
    adjustTreeDisplay();
}
```

---

### 步骤 4：进度指示器 UI

```javascript
function updateProgress(stage, percent) {
    const loadingEl = document.getElementById('loading-overlay');
    if (loadingEl) {
        const progressBar = loadingEl.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = percent + '%';
            progressBar.textContent = percent + '%';
        }
    }
}
```

HTML：
```html
<div id="loading-overlay">
    <div class="loading-content">
        <div class="progress-bar" style="width: 0%; transition: width 0.3s;">0%</div>
        <p>正在生成族谱...</p>
    </div>
</div>
```

---

## 🧪 **测试计划**

1. 大文件测试（1000+ 人）
   - 主线程：UI 保持响应（可滚动、点击按钮）
   - Worker：后台计算，完成后自动渲染

2. 小文件测试（<100 人）
   - 功能正常
   - 降级机制：Worker 失败时自动回退主线程

3. 进度显示
   - 计算期间显示进度条
   - 完成后自动消失

---

## ⚠️ **注意事项**

1. **浏览器兼容性**：
   - Worker 支持：Chrome/Firefox/Edge/Safari 均支持
   - 降级：`if (window.Worker)` 检测

2. **数据传递**：
   - `postMessage` 使用结构化克隆（深拷贝）
   - 大数据量时可能有性能开销
   - 优化：只传递必要字段

3. **错误处理**：
   - Worker `onerror` 捕获异常
   - 自动降级到主线程计算

---

## 🚀 **实施顺序**

1. [ ] 重构 `buildTree` → `buildTreePure`（返回 JSON 结构）
2. [ ] 新增 `renderTreeFromData()`（JSON → DOM）
3. [ ] 创建 `worker.js`（后台计算）
4. [ ] 修改 `core.js` - Worker 初始化和通信
5. [ ] 进度条 UI 和更新逻辑
6. [ ] 测试（大文件、小文件、降级）
7. [ ] 文档和提交

**开始编码！**
