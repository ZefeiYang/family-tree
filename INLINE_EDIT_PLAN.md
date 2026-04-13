# 内联编辑功能 - 详细设计

## 架构决策

### 方案对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| **A. 修改 buildTree 输出 input** | 简单直接 | 破坏现有 HTML 结构，4 个样式要改 4 遍 | ❌ |
| **B. 事件委托 + contenteditable** | 不修改 buildTree，集中逻辑，易维护 | 需要处理光标管理 | ✅ **选中** |
| **C. 双击编辑** | 避免误触 | 用户可能不知道可编辑 | 可选 |

---

## 实施方案（方案 B）

### 1. **HTML 结构增强（最小侵入）**

在 `buildTree()` 的**最开头**（生成任何 HTML 之前）为人物容器添加数据属性：

```javascript
// 在 buildTree 开头添加
const personId = person.人物ID;
const personName = person.姓名 || '未知';

// 所有样式共享的 person div 添加 data 属性
html = `<div class="person ${selectedStyle}" data-person-id="${personId}" data-person-name="${personName}">`;
```

**不需要改 4 个样式分支的细节**，只需在 person 容器上标记。

---

### 2. **事件委托（集中处理）**

在 `generateFamilyTree()` 创建树后，添加全局点击监听：

```javascript
// 在 generateFamilyTree 末尾（treeContainer 创建后）
treeContainer.addEventListener('click', handlePersonClick);
treeContainer.addEventListener('dblclick', handlePersonDoubleClick); // 可选
```

**事件处理逻辑**：
```javascript
function handlePersonClick(e) {
    // 查找被点击的 .person 元素
    const personEl = e.target.closest('.person');
    if (!personEl) return;

    const personId = personEl.dataset.personId;
    const field = detectFieldFromClick(e.target);

    if (field) {
        startInlineEdit(personId, field, personEl);
    }
}

function detectFieldFromClick(target) {
    // 根据点击的元素 class 判断字段
    if (target.classList.contains('name')) return '姓名';
    if (target.classList.contains('dates')) return '出生日期'; // 简化：只编辑出生日期
    return null;
}
```

---

### 3. **编辑状态管理**

**数据结构**：
```javascript
const editingState = {
    personId: null,
    field: null,
    input: null,
    originalValue: null
};
```

**启动编辑**：
```javascript
function startInlineEdit(personId, field, personEl) {
    // 防止重复编辑
    if (editingState.personId) return;

    const person = window.personMap[personId];
    const originalValue = person[field];
    const currentDisplay = getDisplayValue(field, originalValue);

    // 创建输入框
    const input = document.createElement('input');
    input.type = field === '出生日期' ? 'date' : 'text';
    input.value = originalValue; // 直接使用原始值（日期是 yyyy-mm-dd 格式）
    input.className = 'inline-edit-input';

    // 替换显示内容
    const displayEl = personEl.querySelector(`.${field === '出生日期' ? 'dates' : 'name'}`);
    displayEl.innerHTML = '';
    displayEl.appendChild(input);
    input.focus();

    // 记录状态
    editingState = { personId, field, input, originalValue, displayEl };

    // 绑定事件
    input.addEventListener('blur', () => saveEdit());
    input.addEventListener('keydown', handleEditKeydown);
}

function handleEditKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
    }
}
```

---

### 4. **保存逻辑**

```javascript
function saveEdit() {
    const { personId, field, input, displayEl } = editingState;
    const newValue = input.value.trim();

    // 验证
    const validationError = validateField(field, newValue);
    if (validationError) {
        showEditStatus(displayEl, 'error', validationError);
        return;
    }

    // 更新数据
    const person = window.personMap[personId];
    person[field] = newValue;

    // 局部更新 DOM（不重绘整棵树）
    const newDisplay = getDisplayValue(field, newValue);
    displayEl.innerHTML = newDisplay;

    // 显示成功状态
    showEditStatus(displayEl, 'success');

    // 清理编辑状态
    editingState = { personId: null, field: null, input: null, originalValue: null, displayEl: null };
}

function validateField(field, value) {
    if (field === '姓名' && !value) {
        return '姓名不能为空';
    }
    if (field === '出生日期' && value) {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return '日期格式无效';
        }
    }
    return null;
}
```

---

### 5. **样式优化**

```css
/* inline-edit.css */
.inline-edit-input {
    width: 100%;
    padding: 4px 8px;
    border: 2px solid #4CAF50;
    border-radius: 4px;
    font-size: inherit;
    font-family: inherit;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    outline: none;
}

.inline-edit-input:focus {
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.3);
}

.edit-status {
    position: absolute;
    top: -20px;
    right: 0;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 3px;
    animation: fadeIn 0.3s, fadeOut 0.3s 1.7s forwards;
}

.edit-status.success { background: #4CAF50; color: white; }
.edit-status.error { background: #f44336; color: white; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
```

---

## 📝 **实施检查清单**

- [ ] 1. 在 `buildTree` 的 person div 添加 `data-person-id`
- [ ] 2. 创建 `setupInlineEdit()` 函数
- [ ] 3. 实现 `startEdit()`、`saveEdit()`、`cancelEdit()`
- [ ] 4. 添加编辑状态样式
- [ ] 5. 实现成功/失败提示（Toast）
- [ ] 6. 日期编辑使用 `<input type="date">`
- [ ] 7. 防止重复编辑（一次只能编辑一个字段）
- [ ] 8. 测试所有场景
- [ ] 9. 更新 `IMPROVEMENT_PLAN.md`
- [ ] 10. 提交并推送

---

## ⚠️ **注意事项**

1. **日期格式**：
   - 原始数据：`"1950-01-01"` 字符串
   - 显示：`"1950年01月01日"`
   - 编辑：`<input type="date">` 需要 `yyyy-mm-dd` 格式
   - 需要 `parseDate()` 转换，保存时转回原格式

2. **配偶编辑**：
   - 暂不实现（需要多选框 UI，复杂）
   - 仅编辑主节点的姓名和日期

3. **重新渲染**：
   - 保存后**不重绘整棵树**，仅更新修改的 DOM
   - 避免焦点丢失、闪烁

4. **移动端**：
   - 日期选择器在移动端是原生 picker
   - 触摸事件需要测试

---

## 🎯 **开始编码**

**第一步**：修改 `buildTree()` 添加 `data-person-id` 属性。

让我先找到 `buildTree` 函数中生成 person div 的位置，然后添加属性。
