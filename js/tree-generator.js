// 树形图生成器，负责处理族谱数据和渲染
import { parseDate, formatDate } from './date-utils.js';

// ============================================
// 数据验证层
// ============================================

/**
 * 验证家族数据，返回错误列表
 * @param {Array} data - 族谱数据数组
 * @returns {Array<{row: number, message: string}>} 错误列表
 */
function validateFamilyData(data) {
    const errors = [];
    if (!Array.isArray(data)) {
        errors.push({ row: 0, message: '数据格式错误：应为数组' });
        return errors;
    }

    // 1. 收集所有ID，检查重复
    const idSet = new Set();
    const idCount = {};
    data.forEach((person, index) => {
        const id = person.人物ID;
        if (id === undefined || id === null || id === '') {
            errors.push({
                row: index + 1,
                message: `第 ${index + 1} 行：人物ID缺失`
            });
        } else {
            idCount[id] = (idCount[id] || 0) + 1;
            if (idCount[id] > 1) {
                errors.push({
                    row: index + 1,
                    message: `第 ${index + 1} 行：人物ID "${id}" 重复（第 ${idCount[id]} 次出现）`
                });
            }
        }
        idSet.add(id);
    });

    // 2. 检查必填字段和引用完整性
    data.forEach((person, index) => {
        const row = index + 1;
        const name = person.姓名;
        if (!name || name.trim() === '') {
            errors.push({
                row,
                message: `第 ${row} 行：姓名不能为空`
            });
        }

        // 检查父母引用
        ['父亲ID', '母亲ID'].forEach(parentType => {
            const parentId = person[parentType];
            if (parentId && !idSet.has(parentId)) {
                errors.push({
                    row,
                    message: `第 ${row} 行：${person.姓名 || '未知人物'} 的${parentType} "${parentId}" 不存在`
                });
            }
        });

        // 检查配偶引用（支持逗号分隔的多个配偶）
        if (person.配偶ID) {
            const spouseIds = String(person.配偶ID).split(',').map(s => s.trim()).filter(s => s);
            spouseIds.forEach(spouseId => {
                if (!idSet.has(spouseId)) {
                    errors.push({
                        row,
                        message: `第 ${row} 行：${person.姓名 || '未知人物'} 的配偶ID "${spouseId}" 不存在`
                    });
                }
            });
        }

        // 检查日期格式和逻辑
        const birthDate = parseDate(person.出生日期);
        const deathDate = parseDate(person.死亡日期);

        if (person.出生日期 && birthDate === null) {
            errors.push({
                row,
                message: `第 ${row} 行：出生日期格式错误 "${person.出生日期}"`
            });
        }

        if (person.死亡日期 && deathDate === null) {
            errors.push({
                row,
                message: `第 ${row} 行：死亡日期格式错误 "${person.死亡日期}"`
            });
        }

        if (birthDate && deathDate && birthDate > deathDate) {
            errors.push({
                row,
                message: `第 ${row} 行：${person.姓名 || '未知人物'} 的出生日期晚于死亡日期`
            });
        }
    });

    // 3. 检测循环引用（亲子关系）
    const cycles = detectCycles(data);
    cycles.forEach(cycle => {
        errors.push({
            row: 0,
            message: `检测到循环引用：${cycle.join(' → ')} → ${cycle[0]}`
        });
    });

    // 4. 检测孤儿节点（有父母ID但父母不存在）- 已在上面检查

    // 5. 警告：多配偶（超过3个）
    data.forEach((person, index) => {
        if (person.配偶ID) {
            const spouseCount = String(person.配偶ID).split(',').filter(s => s.trim()).length;
            if (spouseCount > 3) {
                errors.push({
                    row: index + 1,
                    message: `第 ${index + 1} 行：${person.姓名 || '未知人物'} 有 ${spouseCount} 个配偶（建议 ≤ 3）`
                });
            }
        }
    });

    return errors;
}

/**
 * 检测亲子关系中的循环引用
 * @param {Array} data - 族谱数据
 * @returns {Array<Array<string>>} 循环路径列表
 */
function detectCycles(data) {
    const cycles = [];
    const personMap = {};
    data.forEach(p => {
        personMap[p.人物ID] = p;
    });

    // 构建父子关系图
    const graph = {};
    data.forEach(p => {
        graph[p.人物ID] = [];
        if (p.父亲ID && personMap[p.父亲ID]) {
            graph[p.人物ID].push(p.父亲ID);
        }
        if (p.母亲ID && personMap[p.母亲ID]) {
            graph[p.人物ID].push(p.母亲ID);
        }
    });

    // DFS 检测循环
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];

    function dfs(node) {
        if (recursionStack.has(node)) {
            // 找到循环，记录路径
            const cycleStart = path.indexOf(node);
            if (cycleStart !== -1) {
                cycles.push([...path.slice(cycleStart), node]);
            }
            return;
        }
        if (visited.has(node)) return;

        visited.add(node);
        recursionStack.add(node);
        path.push(node);

        const parents = graph[node] || [];
        for (const parent of parents) {
            dfs(parent);
        }

        path.pop();
        recursionStack.delete(node);
    }

    Object.keys(graph).forEach(node => {
        if (!visited.has(node)) {
            dfs(node);
        }
    });

    return cycles;
}

/**
 * 获取人物的祖先路径（从根到当前）
 * @param {string} personId - 当前人物ID
 * @param {Object} personMap - 人物ID映射表
 * @returns {Array<Object>} 祖先数组 [{id, name, generation}, ...]
 */
function getAncestorPath(personId, personMap) {
    const path = [];
    let current = personMap[personId];
    
    while (current) {
        const parentIds = [];
        if (current.父亲ID && personMap[current.父亲ID]) {
            parentIds.push({ id: current.父亲ID, type: '父亲' });
        }
        if (current.母亲ID && personMap[current.母亲ID]) {
            parentIds.push({ id: current.母亲ID, type: '母亲' });
        }
        
        if (parentIds.length === 0) break;
        
        // 优先显示父亲，然后是母亲
        const parent = parentIds[0];
        const parentPerson = personMap[parent.id];
        if (parentPerson) {
            path.unshift({
                id: parentPerson.人物ID,
                name: parentPerson.姓名 || '未知',
                relation: parent.type
            });
            current = parentPerson;
        } else {
            break;
        }
    }
    
    return path;
}

/**
 * 创建面包屑导航元素
 * @param {Object} currentPerson - 当前人物对象
 * @param {Object} personMap - 人物ID映射表
 * @returns {HTMLElement|null} 面包屑容器
 */
function createBreadcrumb(currentPerson, personMap) {
    const ancestors = getAncestorPath(currentPerson.人物ID, personMap);
    
    // 如果层级小于3，不显示面包屑
    if (ancestors.length < 2) {
        return null;
    }
    
    const container = document.createElement('div');
    container.className = 'breadcrumb-container';
    container.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 20px;
        margin-bottom: 15px;
        background-color: #f8f9fa;
        border-radius: 6px;
        font-size: 14px;
    `;
    
    // 添加"返回根"按钮
    const rootButton = document.createElement('button');
    rootButton.textContent = '⟲ 返回根';
    rootButton.type = 'button';
    rootButton.tabIndex = 0;
    rootButton.setAttribute('aria-label', '返回根节点');
    rootButton.style.cssText = `
        padding: 4px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 13px;
        color: #666;
        transition: all 0.2s;
    `;
    rootButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.familyTreeData) {
            generateFamilyTree(window.familyTreeData, currentPerson.人物ID);
        }
    });
    rootButton.addEventListener('mouseenter', () => {
        rootButton.style.backgroundColor = '#e9ecef';
    });
    rootButton.addEventListener('mouseleave', () => {
        rootButton.style.backgroundColor = 'white';
    });
    // 键盘支持
    rootButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            rootButton.click();
        }
    });
    container.appendChild(rootButton);
    
    // 添加分隔符
    const addSeparator = () => {
        const sep = document.createElement('span');
        sep.textContent = '›';
        sep.style.cssText = `color: #999; font-size: 18px;`;
        container.appendChild(sep);
    };
    
    addSeparator();
    
    // 渲染祖先节点
    ancestors.forEach((ancestor, index) => {
        const link = document.createElement('button');
        link.textContent = ancestor.name;
        link.type = 'button';
        link.tabIndex = 0;
        link.setAttribute('aria-label', `${ancestor.relation}：${ancestor.name}，点击切换根节点`);
        link.title = `${ancestor.relation}：${ancestor.name}`;
        link.style.cssText = `
            padding: 4px 10px;
            border: 1px solid #4CAF50;
            border-radius: 4px;
            background: white;
            color: #4CAF50;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        `;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.familyTreeData) {
                generateFamilyTree(window.familyTreeData, ancestor.id);
            }
        });
        link.addEventListener('mouseenter', () => {
            link.style.backgroundColor = '#4CAF50';
            link.style.color = 'white';
        });
        link.addEventListener('mouseleave', () => {
            link.style.backgroundColor = 'white';
            link.style.color = '#4CAF50';
        });
        // 键盘支持
        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                link.click();
            }
        });
        container.appendChild(link);
        
        // 如果不是最后一个祖先，添加分隔符
        if (index < ancestors.length - 1) {
            addSeparator();
        }
    });
    
    // 当前节点
    addSeparator();
    const currentSpan = document.createElement('span');
    currentSpan.textContent = currentPerson.姓名 || '未知';
    currentSpan.style.cssText = `
        padding: 4px 10px;
        background-color: #4CAF50;
        color: white;
        border-radius: 4px;
        font-weight: bold;
        font-size: 13px;
    `;
    container.appendChild(currentSpan);
    
    return container;
}

// ============================================
// 原有代码从下面继续
// ============================================

// 族谱生成函数 - 主要入口点
function generateFamilyTree(data, selectedRootId = null) {
    const container = document.getElementById('tree-container');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<p>没有找到族谱数据</p>';
        return;
    }

    // 创建人物ID映射，提高查询效率
    const personMap = {};
    data.forEach(person => {
        person.配偶ID = String(person.配偶ID || '');
        personMap[person.人物ID] = person;
    });
    
    // 缓存映射供其他函数使用
    window.personMap = personMap;
    window.familyTreeData = data;

    // ============================================
    // 添加面包屑导航（如果选择了根节点）
    // ============================================
    if (selectedRootId && personMap[selectedRootId]) {
        const breadcrumb = createBreadcrumb(personMap[selectedRootId], personMap);
        if (breadcrumb) {
            container.appendChild(breadcrumb);
        }
    }

    // 创建下拉框容器
    const selectContainer = document.createElement('div');
    selectContainer.className = 'select-container';
    
    // 创建可搜索的下拉列表组件
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'select-wrapper';
    
    // 将所有人添加到数组中，按姓名排序
    const sortedData = [...data].sort((a, b) => {
        const nameA = a.姓名 || '未知';
        const nameB = b.姓名 || '未知';
        return nameA.localeCompare(nameB, 'zh-CN');
    });
    
    // 创建下拉菜单选择器
    const rootSelect = document.createElement('select');
    rootSelect.id = 'root-select';
    rootSelect.className = 'root-selector';
    rootSelect.size = 10; // 显示10个选项
    
    // 添加提示标签
    const selectLabel = document.createElement('label');
    selectLabel.htmlFor = 'root-select';
    selectLabel.textContent = '选择任意一人作为族谱起点：';
    selectLabel.style.display = 'block';
    selectLabel.style.marginBottom = '5px';
    selectLabel.style.fontWeight = 'bold';
    selectLabel.style.color = '#333';
    
    // 将标签添加到容器中
    selectContainer.appendChild(selectLabel);
    
    // 添加所有人物选项
    sortedData.forEach(person => {
        const option = document.createElement('option');
        option.value = person.人物ID;
        option.textContent = person.姓名 || '未知';
        rootSelect.appendChild(option);
    });
    
    // 创建搜索输入框
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'person-search';
    searchInput.className = 'person-search';
    searchInput.placeholder = '搜索姓名...';
    
    // 清除按钮
    const clearButton = document.createElement('button');
    clearButton.className = 'search-clear-button';
    clearButton.innerHTML = '×';
    clearButton.title = '清除搜索';
    clearButton.style.display = 'none';
    
    // 将元素添加到容器中
    selectWrapper.appendChild(searchInput);
    selectWrapper.appendChild(clearButton);
    
    selectContainer.appendChild(selectWrapper);
    selectContainer.appendChild(rootSelect);
    
    // 搜索功能实现
    searchInput.addEventListener('input', function() {
        const searchText = this.value.trim().toLowerCase();
        
        // 显示/隐藏清除按钮
        clearButton.style.display = searchText ? 'block' : 'none';
        
        // 如果搜索框为空，显示所有选项
        if (!searchText) {
            const options = Array.from(rootSelect.querySelectorAll('option'));
            options.forEach(option => {
                option.style.display = '';
            });
            return;
        }
        
        // 过滤下拉列表选项
        const options = Array.from(rootSelect.querySelectorAll('option'));
        options.forEach(option => {
            const name = option.textContent.toLowerCase();
            option.style.display = name.includes(searchText) ? '' : 'none';
        });
    });
    
    // 输入框选择事件
    searchInput.addEventListener('change', function() {
        const searchText = this.value.trim();
        
        // 查找匹配的人物
        const matchedPerson = sortedData.find(person => 
            (person.姓名 || '未知') === searchText
        );
        
        // 如果找到匹配的人物，更新下拉列表并生成族谱
        if (matchedPerson) {
            rootSelect.value = matchedPerson.人物ID;
            generateFamilyTree(data, matchedPerson.人物ID);
        }
    });
    
    // 清除按钮事件
    clearButton.addEventListener('click', function() {
        searchInput.value = '';
        this.style.display = 'none';
        searchInput.focus();
        
        // 恢复所有选项可见
        const options = Array.from(rootSelect.querySelectorAll('option')).slice(1);
        options.forEach(option => {
            option.style.display = '';
            option.classList.remove('keyboard-highlight');
        });
    });
    
    // 键盘导航状态
    let highlightedIndex = -1;
    let visibleOptions = [];
    
    // 更新高亮显示
    function updateHighlight(newIndex) {
        // 移除旧的高亮
        visibleOptions.forEach((option, idx) => {
            if (idx === newIndex) {
                option.classList.add('keyboard-highlight');
                option.scrollIntoView({ block: 'nearest' });
            } else {
                option.classList.remove('keyboard-highlight');
            }
        });
        highlightedIndex = newIndex;
    }
    
    // 获取当前可见选项列表
    function getVisibleOptions() {
        return Array.from(rootSelect.querySelectorAll('option'))
            .filter(option => option.style.display !== 'none' && option.value);
    }
    
    // 按键事件处理 - 完整键盘导航
    searchInput.addEventListener('keydown', function(e) {
        visibleOptions = getVisibleOptions();
        
        // ESC 键清空搜索
        if (e.key === 'Escape') {
            e.preventDefault();
            this.value = '';
            clearButton.style.display = 'none';
            highlightedIndex = -1;
            
            // 恢复所有选项可见并移除高亮
            const allOptions = Array.from(rootSelect.querySelectorAll('option'));
            allOptions.forEach(option => {
                option.style.display = '';
                option.classList.remove('keyboard-highlight');
            });
            
            // 隐藏下拉框
            rootSelect.blur();
            return;
        }
        
        // 向下箭头 - 向下移动高亮
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (visibleOptions.length === 0) return;
            
            // 如果下拉框未打开，先打开
            if (document.activeElement !== rootSelect) {
                rootSelect.focus();
            }
            
            const newIndex = Math.min(highlightedIndex + 1, visibleOptions.length - 1);
            updateHighlight(newIndex);
            rootSelect.value = visibleOptions[newIndex].value;
            return;
        }
        
        // 向上箭头 - 向上移动高亮
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (visibleOptions.length === 0) return;
            
            if (document.activeElement !== rootSelect) {
                rootSelect.focus();
            }
            
            const newIndex = Math.max(highlightedIndex - 1, 0);
            updateHighlight(newIndex);
            rootSelect.value = visibleOptions[newIndex].value;
            return;
        }
        
        // Enter 键选择高亮项
        if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && visibleOptions[highlightedIndex]) {
                const selectedOption = visibleOptions[highlightedIndex];
                rootSelect.value = selectedOption.value;
                searchInput.value = selectedOption.textContent;
                generateFamilyTree(data, selectedOption.value);
                rootSelect.blur();
                highlightedIndex = -1;
                visibleOptions.forEach(opt => opt.classList.remove('keyboard-highlight'));
            } else if (visibleOptions.length > 0) {
                // 如果没有高亮但有可见选项，选择第一个
                const firstOption = visibleOptions[0];
                rootSelect.value = firstOption.value;
                searchInput.value = firstOption.textContent;
                generateFamilyTree(data, firstOption.value);
                rootSelect.blur();
            }
            return;
        }
        
        // Tab 键：如果下拉框打开且有高亮，选择高亮项
        if (e.key === 'Tab') {
            if (highlightedIndex >= 0 && visibleOptions[highlightedIndex]) {
                e.preventDefault();
                const selectedOption = visibleOptions[highlightedIndex];
                rootSelect.value = selectedOption.value;
                searchInput.value = selectedOption.textContent;
                generateFamilyTree(data, selectedOption.value);
                highlightedIndex = -1;
                visibleOptions.forEach(opt => opt.classList.remove('keyboard-highlight'));
            }
        }
    });
    
    // 下拉列表获得焦点时，高亮第一项
    rootSelect.addEventListener('focus', function() {
        const currentVisible = getVisibleOptions();
        if (currentVisible.length > 0) {
            // 找到当前选中项的位置
            const currentValue = this.value;
            const currentIndex = currentVisible.findIndex(opt => opt.value === currentValue);
            highlightedIndex = currentIndex >= 0 ? currentIndex : 0;
            updateHighlight(highlightedIndex);
        }
    });
    
    // 下拉列表失焦时清除高亮
    rootSelect.addEventListener('blur', function() {
        setTimeout(() => {
            visibleOptions.forEach(opt => opt.classList.remove('keyboard-highlight'));
            highlightedIndex = -1;
        }, 100);
    });
    
    // 下拉列表变化事件
    rootSelect.addEventListener('change', function() {
        const selectedId = this.value;
        if (selectedId) {
            // 更新搜索框的值为选中的人物名称
            const selectedOption = this.options[this.selectedIndex];
            searchInput.value = selectedOption.textContent;
            
            // 生成族谱
            generateFamilyTree(data, selectedId);
            
            // 选择后自动失去焦点，隐藏下拉框
            this.blur();
        } else {
            container.innerHTML = '';
        }
    });
    
    // 如果有预选的ID，设置为选中状态
    if (selectedRootId) {
        rootSelect.value = selectedRootId;
        // 同时更新搜索框
        const selectedOption = rootSelect.querySelector(`option[value="${selectedRootId}"]`);
        if (selectedOption) {
            searchInput.value = selectedOption.textContent;
        }
    }
    
    // 下拉框和搜索框失去焦点时隐藏下拉框
    document.addEventListener('click', function(e) {
        // 如果点击的不是搜索框、下拉框或它们的子元素
        if (!e.target.closest('.select-wrapper') && 
            !e.target.closest('.root-selector')) {
            // 让下拉框失去焦点
            if (rootSelect) {
                rootSelect.blur();
            }
        }
    });
    
    const treeWrapper = document.createElement('div');
    treeWrapper.className = 'tree-wrapper';
    
    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'selector-container';
    selectorContainer.appendChild(selectContainer);
    container.appendChild(selectorContainer);
    
    const treeContainer = document.createElement('div');
    treeContainer.id = 'tree-content';
    treeWrapper.appendChild(treeContainer);
    container.appendChild(treeWrapper);
    
    // 如果选择了一个根节点
    if (selectedRootId) {
        // 找到选中的人物作为根节点
        const selectedRoot = personMap[selectedRootId];
        if (!selectedRoot) {
            treeContainer.innerHTML = '<p>未找到选中的人物，请重新选择</p>';
            return;
        }
        
        const renderTarget = treeContainer;
        const selectedStyle = document.getElementById('treeStyle').value;

        // 创建族谱树
        const treeDiv = document.createElement('div');
        treeDiv.className = `family-tree ${selectedStyle}`;
        
        // 计算族谱规模，预估宽度
        const { depth, width } = calculateTreeSize(selectedRoot, 0);
        
        // 设置适当的宽度以避免内容挤压
        if (width > 5) {
            // 如果树很宽，增加容器宽度
            treeContainer.style.minWidth = Math.max(1000, width * 150) + 'px';
        }
        
        // 构建树
        const rootNode = buildTree(selectedRoot, 0, null);
        treeDiv.innerHTML = rootNode;
        
        renderTarget.appendChild(treeDiv);
        
        // 调整树形图样式，确保更好的显示效果
        adjustTreeDisplay();
    }
    
    // ============================================
    // 内联编辑：事件委托
    // =parameter>
    // 在容器上委托处理点击事件
    // ============================================
    const treeContentEl = document.getElementById('tree-content');
    if (treeContentEl) {
        // 点击开始编辑
        treeContentEl.addEventListener('click', function(e) {
            const target = e.target;
            
            // 检查是否点击了可编辑字段
            if (target.classList.contains('name') || target.classList.contains('dates')) {
                const personEl = target.closest('.person');
                if (!personEl) return;
                
                const personId = personEl.dataset.personId;
                const field = target.dataset.field;
                
                // 防止正在编辑时重复触发
                if (window.editingState && window.editingState.personId) {
                    return;
                }
                
                startInlineEdit(personId, field, target, personEl);
            }
        });
        
        // 键盘快捷键（全局）
        treeContentEl.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && window.editingState) {
                cancelEdit();
            }
        });
    }
}



// 计算树的规模 - 用于确定容器大小
function calculateTreeSize(person, level) {
    if (!person) return { depth: level, width: 0 };
    
    let maxChildDepth = level;
    let totalWidth = 1; // 当前节点宽度
    
    // 查找所有子代
    const children = window.familyTreeData.filter(child =>
        child.父亲ID === person.人物ID || child.母亲ID === person.人物ID
    );
    
    if (children.length === 0) {
        return { depth: level, width: 1 };
    }
    
    // 递归计算每个子代的规模
    children.forEach(child => {
        const { depth, width } = calculateTreeSize(child, level + 1);
        maxChildDepth = Math.max(maxChildDepth, depth);
        totalWidth += width;
    });
    
    return { depth: maxChildDepth, width: totalWidth };
}

// 调整树的显示 - 根据不同样式优化显示效果
function adjustTreeDisplay() {
    const selectedStyle = document.getElementById('treeStyle').value;
    const treeContent = document.getElementById('tree-content');
    
    // 根据不同样式应用不同的优化
    if (selectedStyle === 'tree') {
        // 对于树形样式，确保连接线正确显示
        const childContainers = treeContent.querySelectorAll('.children-container');
        childContainers.forEach(container => {
            const children = container.querySelectorAll('.child');
            if (children.length > 4) {
                container.style.maxWidth = (children.length * 220) + 'px';
            }
        });
    } else if (selectedStyle === 'horizontal') {
        // 对于水平样式，增加间距以显示所有内容
        const persons = treeContent.querySelectorAll('.person.horizontal');
        persons.forEach(person => {
            person.style.marginRight = '20px';
        });
    }
}

// 获取性别图标 - 返回对应性别的 SVG 图标
function getGenderIcon(gender) {
    if (gender === '男') {
        return `<span class="gender-icon gender-male" title="男性">
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M20,11V7H16V3H12V7H8V11H12V8L16,12L12,16V13H8V17H12V21H16V17H20V13H16V16L12,12L16,8V11H20Z" />
            </svg>
        </span>`;
    } else if (gender === '女') {
        return `<span class="gender-icon gender-female" title="女性">
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M12,4A6,6 0 0,1 18,10C18,12.97 15.84,15.44 13,15.92V18H15V20H13V22H11V20H9V18H11V15.92C8.16,15.44 6,12.97 6,10A6,6 0 0,1 12,4M12,6A4,4 0 0,0 8,10A4,4 0 0,0 12,14A4,4 0 0,0 16,10A4,4 0 0,0 12,6Z" />
            </svg>
        </span>`;
    }
    return `<span class="gender-icon gender-unknown" title="未知">
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7" />
        </svg>
    </span>`;
}

// 获取子女序号标记 - 显示在人物名称旁边
function getChildOrderLabel(index) {
    return `<span class="child-order" title="第${index + 1}子女">${index + 1}</span>`;
}

// 构建树节点 - 递归函数，构建整个族谱树的 HTML
function buildTree(person, level = 0, parentInfo = null) {
    if (!person) return '';
    
    const birthDate = formatDate(parseDate(person.出生日期));
    const deathDate = formatDate(parseDate(person.死亡日期));
    const selectedStyle = document.getElementById('treeStyle').value;
    
    // 获取性别图标
    const genderIcon = getGenderIcon(person.性别);

    // 使用personMap提高性能
    const personMap = window.personMap || {};
    
    // 确定子女序号
    let childOrderLabel = '';
    if (parentInfo && parentInfo.childIndex !== undefined) {
        childOrderLabel = getChildOrderLabel(parentInfo.childIndex);
    }

    // 代数显示标签
    const generationLabel = `第${level + 1}代`;

    let html = '';
    if (selectedStyle === 'tree') {
        html = `<div class="person ${selectedStyle}" data-person-id="${person.人物ID}" data-person-name="${person.姓名 || '未知'}">`;
        html += `<div class="person-node">`;
        html += `<div class="person-content">`;
        html += `<div class="generation">${generationLabel}</div>`;
        html += `<div class="name" data-field="姓名">${childOrderLabel}${person.姓名 || '未知'} ${genderIcon}</div>`;
        html += `<div class="dates" data-field="出生日期">${birthDate || ''} ${deathDate ? ' - ' + deathDate : ''}</div>`;
        html += `</div>`;

        if (person.配偶ID) {
            const spouseIdStr = String(person.配偶ID || '');
            const spouseIds = spouseIdStr.split(',');
            spouseIds.forEach(spouseId => {
                const spouse = personMap[spouseId] || window.familyTreeData.find(p => p.人物ID === spouseId);
                if (spouse) {
                    const spouseBirthDate = formatDate(parseDate(spouse.出生日期));
                    const spouseDeathDate = formatDate(parseDate(spouse.死亡日期));
                    const spouseGenderIcon = getGenderIcon(spouse.性别);
                    html += `<div class="spouse-details">`;
                    html += `<div class="spouse-content">`;
                    html += `<div class="name" data-field="姓名">${spouse.姓名 || '未知'} ${spouseGenderIcon}</div>`;
                    html += `<div class="dates" data-field="出生日期">${spouseBirthDate || ''} ${spouseDeathDate ? ' - ' + spouseDeathDate : ''}</div>`;
                    html += `</div>`;
                    html += `</div>`;
                }
            });
        }
        html += `</div>`;

        // 获取并排序子代
        const children = window.familyTreeData.filter(child =>
            child.父亲ID === person.人物ID || child.母亲ID === person.人物ID
        );

        // 按出生日期排序子女
        children.sort((a, b) => {
            const dateA = parseDate(a.出生日期);
            const dateB = parseDate(b.出生日期);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB;
        });

        if (children.length > 0) {
            html += '<div class="children">';
            html += '<div class="children-container">';
            children.forEach((child, index) => {
                const childInfo = {
                    childIndex: index,
                    totalChildren: children.length
                };
                html += `<div class="child">${buildTree(child, level + 1, childInfo)}</div>`;
            });
            html += '</div>';
            html += '</div>';
        }

        html += '</div>';
    } else if (selectedStyle === 'classic') {
        html = `<div class="person ${selectedStyle}" data-person-id="${person.人物ID}" data-person-name="${person.姓名 || '未知'}">`;
        html += `<div class="person-node">`;
        html += `<div class="person-content">`;
        html += `<div class="generation">${generationLabel}</div>`;
        html += `<div class="name" data-field="姓名">${childOrderLabel}${person.姓名 || '未知'} ${genderIcon}</div>`;
        html += `<div class="dates" data-field="出生日期">${birthDate || ''} ${deathDate ? ' - ' + deathDate : ''}</div>`;
        html += `</div>`;

        if (person.配偶ID) {
            const spouseIdStr = String(person.配偶ID || '');
            const spouseIds = spouseIdStr.split(',');
            spouseIds.forEach(spouseId => {
                const spouse = personMap[spouseId] || window.familyTreeData.find(p => p.人物ID === spouseId);
                if (spouse) {
                    const spouseBirthDate = formatDate(parseDate(spouse.出生日期));
                    const spouseDeathDate = formatDate(parseDate(spouse.死亡日期));
                    const spouseGenderIcon = getGenderIcon(spouse.性别);
                    html += `<div class="spouse-details">`;
                    html += `<span class="name" data-field="姓名">${spouse.姓名 || '未知'} ${spouseGenderIcon}</span>`;
                    html += `<span class="connector"></span>`;
                    html += `<span class="dates">${spouseBirthDate || ''} ${spouseDeathDate ? ' - ' + spouseDeathDate : ''}</span>`;
                    html += `</div>`;
                }
            });
        }
        html += `</div>`;

        const children = window.familyTreeData.filter(child =>
            child.父亲ID === person.人物ID || child.母亲ID === person.人物ID
        );

        // 按出生日期排序子女
        children.sort((a, b) => {
            const dateA = parseDate(a.出生日期);
            const dateB = parseDate(b.出生日期);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB;
        });

        if (children.length > 0) {
            html += '<div class="children">';
            html += '<div class="connector"></div>';
            html += '<div class="children-container">';
            children.forEach((child, index) => {
                const childInfo = {
                    childIndex: index,
                    totalChildren: children.length
                };
                html += buildTree(child, level + 1, childInfo);
            });
            html += '</div>';
            html += '</div>';
        }

        html += '</div>';
    } else if (selectedStyle === 'vertical') {
        html = `<div class="person ${selectedStyle}" data-person-id="${person.人物ID}" data-person-name="${person.姓名 || '未知'}">`;
        html += `<div class="person-info">`;
        html += `<div class="person-details">`;
        html += `<div class="generation">${generationLabel}</div>`;
        html += `<div class="name" data-field="姓名">${childOrderLabel}${person.姓名 || '未知'} ${genderIcon}</div>`;
        html += `<div class="dates" data-field="出生日期">${birthDate || ''} ${deathDate ? ' - ' + deathDate : ''}</div>`;
        html += `</div>`;

        if (person.配偶ID) {
            const spouseIdStr = String(person.配偶ID || '');
            const spouseIds = spouseIdStr.split(',');
            spouseIds.forEach(spouseId => {
                const spouse = personMap[spouseId] || window.familyTreeData.find(p => p.人物ID === spouseId);
                if (spouse) {
                    const spouseBirthDate = formatDate(parseDate(spouse.出生日期));
                    const spouseDeathDate = formatDate(parseDate(spouse.死亡日期));
                    const spouseGenderIcon = getGenderIcon(spouse.性别);
                    html += `<div class="spouse-details">`;
                    html += `<span class="name" data-field="姓名">${spouse.姓名 || '未知'} ${spouseGenderIcon}</span>`;
                    html += `<span class="connector">❤</span>`;
                    html += `<span class="dates">${spouseBirthDate || ''} ${spouseDeathDate ? ' - ' + spouseDeathDate : ''}</span>`;
                    html += `</div>`;
                }
            });
        }
        html += `</div>`;

        const children = window.familyTreeData.filter(child =>
            child.父亲ID === person.人物ID || child.母亲ID === person.人物ID
        );

        // 按出生日期排序子女
        children.sort((a, b) => {
            const dateA = parseDate(a.出生日期);
            const dateB = parseDate(b.出生日期);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB;
        });

        if (children.length > 0) {
            html += '<div class="children">';
            children.forEach((child, index) => {
                const childInfo = {
                    childIndex: index,
                    totalChildren: children.length
                };
                html += buildTree(child, level + 1, childInfo);
            });
            html += '</div>';
        }

        html += '</div>';
    } else if (selectedStyle === 'horizontal') {
        html = `<div class="person ${selectedStyle}" data-person-id="${person.人物ID}" data-person-name="${person.姓名 || '未知'}">`;
        html += `<div class="person-info">`;
        html += `<div class="person-details">`;
        html += `<div class="generation">${generationLabel}</div>`;
        html += `<div class="name" data-field="姓名">${childOrderLabel}${person.姓名 || '未知'} ${genderIcon}</div>`;
        html += `<div class="dates" data-field="出生日期">${birthDate || ''} ${deathDate ? ' - ' + deathDate : ''}</div>`;
        html += `</div>`;

        if (person.配偶ID) {
            const spouseIdStr = String(person.配偶ID || '');
            const spouseIds = spouseIdStr.split(',');
            spouseIds.forEach(spouseId => {
                const spouse = personMap[spouseId] || window.familyTreeData.find(p => p.人物ID === spouseId);
                if (spouse) {
                    const spouseBirthDate = formatDate(parseDate(spouse.出生日期));
                    const spouseDeathDate = formatDate(parseDate(spouse.死亡日期));
                    const spouseGenderIcon = getGenderIcon(spouse.性别);
                    html += `<div class="spouse-details">`;
                    html += `<span class="name" data-field="姓名">${spouse.姓名 || '未知'} ${spouseGenderIcon}</span>`;
                    html += `<span class="connector">❤</span>`;
                    html += `<span class="dates">${spouseBirthDate || ''} ${spouseDeathDate ? ' - ' + spouseDeathDate : ''}</span>`;
                    html += `</div>`;
                }
            });
        }
        html += `</div>`;

        const children = window.familyTreeData.filter(child =>
            child.父亲ID === person.人物ID || child.母亲ID === person.人物ID
        );

        // 按出生日期排序子女
        children.sort((a, b) => {
            const dateA = parseDate(a.出生日期);
            const dateB = parseDate(b.出生日期);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB;
        });

        if (children.length > 0) {
            html += '<div class="children">';
            children.forEach((child, index) => {
                const childInfo = {
                    childIndex: index,
                    totalChildren: children.length
                };
                html += buildTree(child, level + 1, childInfo);
            });
            html += '</div>';
        }

        html += '</div>';
    }

    return html;
}

// ============================================
// 内联编辑功能
// ============================================

// 编辑状态管理（单例）
window.editingState = {
    personId: null,
    field: null,
    input: null,
    originalValue: null,
    displayEl: null
};

/**
 * 开始内联编辑
 */
function startInlineEdit(personId, field, displayEl, personEl) {
    // 如果已有编辑，先保存
    if (window.editingState.personId && window.editingState.personId !== personId) {
        saveEdit();
    }
    
    const person = window.personMap[personId];
    if (!person) return;
    
    const originalValue = person[field];
    const currentDisplay = getDisplayValue(field, originalValue);
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = field === '出生日期' ? 'date' : 'text';
    input.className = 'inline-edit-input';
    input.value = field === '出生日期' ? originalValue : (person.姓名 || '');
    
    // 替换显示内容
    displayEl.innerHTML = '';
    displayEl.appendChild(input);
    input.focus();
    
    // 记录编辑状态
    window.editingState = {
        personId,
        field,
        input,
        originalValue,
        displayEl,
        personEl
    };
    
    // 添加编辑样式
    personEl.classList.add('editing');
    
    // 绑定事件
    input.addEventListener('blur', () => saveEdit());
    input.addEventListener('keydown', handleEditKeydown);
}

/**
 * 处理编辑键盘事件
 */
function handleEditKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
    }
}

/**
 * 保存编辑
 */
function saveEdit() {
    const state = window.editingState;
    if (!state.personId) return;
    
    const { personId, field, input, displayEl, personEl } = state;
    const newValue = input.value.trim();
    
    // 验证
    const validationError = validateField(field, newValue);
    if (validationError) {
        showEditStatus(displayEl, 'error', validationError);
        return;
    }
    
    // 更新数据
    const person = window.personMap[personId];
    person[field] = field === '出生日期' ? newValue : newValue;
    
    // 局部更新 DOM
    const newDisplay = getDisplayValue(field, newValue);
    displayEl.innerHTML = newDisplay;
    
    // 移除编辑状态
    personEl.classList.remove('editing');
    window.editingState = { personId: null, field: null, input: null, originalValue: null, displayEl: null };
    
    // 显示成功提示
    showEditStatus(displayEl, 'success');
}

/**
 * 取消编辑
 */
function cancelEdit() {
    const state = window.editingState;
    if (!state.personId) return;
    
    const { displayEl, originalValue, field, personEl } = state;
    
    // 恢复原值
    const originalDisplay = getDisplayValue(field, originalValue);
    displayEl.innerHTML = originalDisplay;
    
    // 清理
    personEl.classList.remove('editing');
    window.editingState = { personId: null, field: null, input: null, originalValue: null, displayEl: null };
}

/**
 * 验证字段值
 */
function validateField(field, value) {
    if (field === '姓名' && !value) {
        return '姓名不能为空';
    }
    if (field === '出生日期' && value) {
        const date = parseDate(value);
        if (!date) {
            return '日期格式无效';
        }
    }
    return null;
}

/**
 * 获取字段显示值（根据 field 和原始值）
 */
function getDisplayValue(field, rawValue) {
    if (field === '姓名') {
        return rawValue || '未知';
    }
    if (field === '出生日期') {
        // 从原始 Excel 格式转换为显示格式
        const date = parseDate(rawValue);
        return formatDate(date);
    }
    return rawValue;
}

/**
 * 显示编辑状态（成功/失败）
 */
function showEditStatus(displayEl, type, message = '') {
    // 移除旧状态
    const oldStatus = displayEl.parentElement.querySelector('.edit-status');
    if (oldStatus) oldStatus.remove();
    
    const status = document.createElement('span');
    status.className = `edit-status ${type}`;
    
    if (type === 'success') {
        status.textContent = '✓ 已保存';
        status.style.cssText = `
            position: absolute;
            top: -20px;
            right: 0;
            background: #4CAF50;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            animation: fadeIn 0.3s, fadeOut 0.3s 1.7s forwards;
            z-index: 10;
        `;
    } else if (type === 'error') {
        status.textContent = `✕ ${message}`;
        status.style.cssText = `
            position: absolute;
            top: -20px;
            right: 0;
            background: #f44336;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            animation: shake 0.3s;
            z-index: 10;
        `;
    }
    
    // 确保父元素相对定位
    if (getComputedStyle(displayEl.parentElement).position === 'static') {
        displayEl.parentElement.style.position = 'relative';
    }
    
    displayEl.parentElement.appendChild(status);
    
    // 自动移除
    setTimeout(() => {
        if (status.parentNode) {
            status.remove();
        }
    }, 2000);
}

// 导出新增函数
export { startInlineEdit, saveEdit, cancelEdit };

// 导出核心函数供测试使用（必须放在函数定义之后）
export { buildTree, calculateTreeSize, getGenderIcon, getChildOrderLabel, validateFamilyData, detectCycles, getAncestorPath, createBreadcrumb, calculateGenerations }; 