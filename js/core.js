// 核心JS文件，处理初始化和事件监听
import { validateFamilyData, calculateGenerations } from './tree-generator.js';
import { familyDB } from './db.js';

let jsPDF;
try {
    // 尝试从window.jspdf获取jsPDF
    if (window.jspdf) {
        jsPDF = window.jspdf.jsPDF;
    } else {
        console.error('jsPDF库未正确加载，PDF导出功能可能不可用');
    }
} catch (e) {
    console.error('初始化jsPDF失败:', e);
}

// 显示验证错误
function displayValidationErrors(errors) {
    const container = document.getElementById('tree-container');
    if (!container) return;

    const errorHtml = `
        <div class="validation-errors" style="
            background-color: #fff3f3;
            border: 1px solid #f5c6cb;
            border-radius: 8px;
            padding: 20px;
            margin: 20px auto;
            max-width: 800px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        ">
            <h3 style="color: #721c24; margin-top: 0; display: flex; align-items: center; gap: 8px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                数据验证失败
            </h3>
            <p style="color: #721c24; margin-bottom: 15px;">
                检测到以下问题，请修正后重新上传：
            </p>
            <ul style="color: #721c24; margin: 0; padding-left: 20px;">
                ${errors.map(err => `
                    <li style="margin-bottom: 8px;">
                        <strong>${err.row > 0 ? `第 ${err.row} 行` : '全局错误'}</strong>: ${err.message}
                    </li>
                `).join('')}
            </ul>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f5c6cb;">
                <button onclick="document.getElementById('excelFile').value = ''" style="
                    background-color: #dc3545;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">重新选择文件</button>
            </div>
        </div>
    `;

    container.innerHTML = errorHtml;
}

// 检查必要的库是否已加载
function checkDependencies() {
    const missingDependencies = [];
    
    // 检查 xlsx 库
    if (typeof XLSX === 'undefined') {
        missingDependencies.push('XLSX');
    }
    
    // 检查 html2canvas 库
    if (typeof html2canvas === 'undefined') {
        missingDependencies.push('html2canvas');
    }
    
    // 检查 Lunar 库
    if (typeof Lunar === 'undefined') {
        missingDependencies.push('Lunar');
    }
    
    // 如果有缺失的依赖，显示警告
    if (missingDependencies.length > 0) {
        console.warn(`缺少以下依赖库: ${missingDependencies.join(', ')}，部分功能可能无法正常工作`);
        return false;
    }
    
    return true;
}

// 全局变量，存储族谱数据
window.familyTreeData = null;

// 初始化函数
async function initApp() {
    // 检查依赖
    const dependenciesLoaded = checkDependencies();
    if (!dependenciesLoaded) {
        const container = document.getElementById('tree-container');
        if (container) {
            container.innerHTML = '<div class="error-message" style="color: red; padding: 20px; text-align: center;">警告：部分必要的库未能加载，功能可能会受限。请检查您的网络连接或刷新页面重试。</div>';
        }
    }

    // 初始化 IndexedDB
    try {
        await familyDB.init();
        console.log('✅ 本地数据库已连接');
    } catch (error) {
        console.error('❌ 本地数据库连接失败:', error);
    }

    // 自动保存定时器
    let autoSaveTimer = null;

    // 自动保存函数（防抖 1 秒）
    window.scheduleAutoSave = () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
            if (window.familyTreeData && window.familyTreeData.length > 0) {
                try {
                    // 获取当前项目 ID（如果有）
                    const currentProjectId = localStorage.getItem('currentProjectId');
                    const projectName = document.title || '未命名族谱';
                    
                    await familyDB.saveProject(
                        {
                            id: currentProjectId,
                            name: projectName,
                            personCount: window.familyTreeData.length
                        },
                        window.familyTreeData,
                        true // 创建版本
                    );
                    
                    console.log('✅ 自动保存完成');
                } catch (error) {
                    console.error('❌ 自动保存失败:', error);
                }
            }
        }, 1000);
    };

    // 监听编辑事件（从 tree-generator.js 调用）
    // 注意：tree-generator.js 中的 saveEdit 函数调用后，会触发 scheduleAutoSave()

    // 获取DOM元素
    const treeStyleSelect = document.getElementById('treeStyle');
    const calendarStyleSelect = document.getElementById('calendarStyle');
    const excelFileInput = document.getElementById('excelFile');
    const exportPngButton = document.getElementById('exportPng');
    const exportPdfButton = document.getElementById('exportPdf');
    const exportSvgButton = document.getElementById('exportSvg');
    const exportJsonButton = document.getElementById('exportJson');
    const importJsonInput = document.getElementById('importJson');

    // 监听样式变化
    treeStyleSelect.addEventListener('change', handleStyleChange);
    
    // 监听日历样式变化
    calendarStyleSelect.addEventListener('change', handleCalendarChange);
    
    // 监听文件上传
    excelFileInput.addEventListener('change', handleFileUpload);
    
    // 导出功能
    exportPngButton.addEventListener('click', exportAsPng);
    exportPdfButton.addEventListener('click', exportAsPdf);
    if (exportSvgButton) {
        exportSvgButton.addEventListener('click', exportAsSvg);
    }
    if (exportJsonButton) {
        exportJsonButton.addEventListener('click', exportAsJson);
    }
    
    // JSON 导入
    if (importJsonInput) {
        importJsonInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                importFromJson(file);
            }
        });
    }

    // ============================================
    // 侧边栏：项目管理和自动保存
    // ============================================
    
    // 侧边栏元素
    const sidebar = document.getElementById('sidebar');
    const projectList = document.getElementById('project-list');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const newProjectBtn = document.getElementById('newProjectBtn');
    
    // 切换侧边栏显示/隐藏
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }
    
    // 加载项目列表
    async function loadProjectList() {
        if (!projectList) return;
        
        try {
            const projects = await familyDB.listProjects();
            projectList.innerHTML = '';
            
            if (projects.length === 0) {
                projectList.innerHTML = '<div class="empty-state">暂无保存的项目</div>';
                return;
            }
            
            projects.forEach(project => {
                const item = document.createElement('div');
                item.className = 'project-item';
                item.dataset.projectId = project.id;
                
                const date = new Date(project.updatedAt).toLocaleDateString('zh-CN');
                
                item.innerHTML = `
                    <div class="project-item-header">
                        <span class="project-name">${project.name}</span>
                        <button class="project-delete" title="删除项目">🗑</button>
                    </div>
                    <div class="project-meta">
                        ${project.personCount} 人 · 更新于 ${date}
                    </div>
                `;
                
                // 点击加载项目
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('project-delete')) {
                        e.stopPropagation();
                        deleteProject(project.id);
                        return;
                    }
                    loadProjectToEditor(project.id);
                });
                
                projectList.appendChild(item);
            });
        } catch (error) {
            console.error('加载项目列表失败:', error);
        }
    }
    
    // 加载项目到编辑器
    async function loadProjectToEditor(projectId) {
        try {
            const { project, data } = await familyDB.loadProject(projectId);
            
            // 更新当前项目 ID
            localStorage.setItem('currentProjectId', project.id);
            
            // 更新文档标题
            document.title = project.name;
            
            // 加载数据并渲染族谱
            window.familyTreeData = data;
            await generateFamilyTree(data);
            
            // 高亮当前项目
            document.querySelectorAll('.project-item').forEach(el => {
                el.classList.toggle('active', el.dataset.projectId === projectId);
            });
            
            // 关闭侧边栏
            sidebar.classList.remove('open');
            
            console.log(`✅ 已加载项目: ${project.name}`);
        } catch (error) {
            console.error('加载项目失败:', error);
            alert('加载项目失败: ' + error.message);
        }
    }
    
    // 删除项目
    async function deleteProject(projectId) {
        if (!confirm('确定要删除这个项目吗？此操作不可撤销。')) {
            return;
        }
        
        try {
            await familyDB.deleteProject(projectId);
            localStorage.removeItem('currentProjectId');
            await loadProjectList();
            console.log('✅ 项目已删除');
        } catch (error) {
            console.error('删除项目失败:', error);
            alert('删除项目失败: ' + error.message);
        }
    }
    
    // 新建/保存项目
    async function saveCurrentProject() {
        if (!window.familyTreeData || window.familyTreeData.length === 0) {
            alert('没有可保存的数据');
            return;
        }
        
        const currentProjectId = localStorage.getItem('currentProjectId');
        const projectName = prompt('项目名称:', document.title);
        if (!projectName) return;
        
        try {
            const projectId = await familyDB.saveProject(
                {
                    id: currentProjectId || null,
                    name: projectName,
                    personCount: window.familyTreeData.length
                },
                window.familyTreeData,
                true // 创建版本
            );
            
            localStorage.setItem('currentProjectId', projectId);
            document.title = projectName;
            
            await loadProjectList();
            alert('✅ 项目已保存');
        } catch (error) {
            console.error('保存项目失败:', error);
            alert('保存项目失败: ' + error.message);
        }
    }
    
    // 绑定新建项目按钮
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', saveCurrentProject);
    }
    
    // 初始化：加载项目列表
    await loadProjectList();
    
    // 恢复上次打开的项目
    const lastProjectId = localStorage.getItem('currentProjectId');
    if (lastProjectId) {
        try {
            const { project, data } = await familyDB.loadProject(lastProjectId);
            window.familyTreeData = data;
            await generateFamilyTree(data);
            document.title = project.name;
            
            // 高亮当前项目
            const currentItem = projectList.querySelector(`[data-project-id="${lastProjectId}"]`);
            if (currentItem) currentItem.classList.add('active');
        } catch (error) {
            console.log('上次打开的项目不存在，已清除记录');
            localStorage.removeItem('currentProjectId');
        }
    }
    
}

// 计算世代数（用于元数据）

// 样式变化处理函数
function handleStyleChange() {
    const selectedStyle = this.value;
    const treeContainer = document.querySelector('.family-tree');
    if (treeContainer) {
        treeContainer.className = `family-tree ${selectedStyle}`;
        // 更新所有人物节点的样式
        const persons = treeContainer.querySelectorAll('.person');
        persons.forEach(person => {
            person.className = `person ${selectedStyle}`;
        });
    }
}

// 日历样式变化处理函数
async function handleCalendarChange() {
    // 重新生成族谱以更新日期显示
    const treeContainer = document.getElementById('tree-content');
    if (treeContainer && treeContainer.innerHTML.trim()) {
        const rootSelect = document.getElementById('root-select');
        if (rootSelect && rootSelect.value) {
            // 获取当前选中的根节点
            const selectedRootId = rootSelect.value;
            // 重新生成族谱
            const existingData = window.familyTreeData;
            if (existingData) {
                await generateFamilyTree(existingData, selectedRootId);
            }
        }
    }
}

// 文件上传处理函数
async function handleFileUpload(e) {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
            raw: false,
            dateNF: 'yyyy/mm/dd',
            cellDates: true
        });

        // 数据验证
        const validationErrors = validateFamilyData(jsonData);
        if (validationErrors.length > 0) {
            displayValidationErrors(validationErrors);
            return; // 阻止生成族谱
        }

        // 保存数据以便日历样式更改时使用
        window.familyTreeData = jsonData;
        await generateFamilyTree(jsonData);
        
        // 自动保存新导入的数据
        if (typeof window.scheduleAutoSave === 'function') {
            window.scheduleAutoSave();
        }
    };
    reader.readAsArrayBuffer(file);
}

// 创建用于导出的克隆树
function createExportClone() {
    const treeContent = document.getElementById('tree-content');
    if (!treeContent) return null;
    
    // 克隆树内容
    const clone = treeContent.cloneNode(true);
    
    // 创建临时容器
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.opacity = '0';
    tempContainer.style.pointerEvents = 'none';
    tempContainer.style.background = '#fff';
    
    // 添加到文档中进行测量
    document.body.appendChild(tempContainer);
    
    // 去除不必要的外边距和内边距
    clone.style.margin = '0';
    clone.style.padding = '20px';
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';
    clone.style.display = 'inline-block';
    clone.style.background = '#fff';
    
    // 为克隆树添加特殊样式
    const style = document.createElement('style');
    style.innerHTML = `
        .family-tree {
            max-width: none !important;
            padding: 10px !important;
        }
        
        .person-node, .person {
            box-shadow: none !important;
            border: 1px solid #ddd !important;
        }
        
        .selector-container, .buttons, .controls {
            display: none !important;
        }
    `;
    clone.appendChild(style);
    
    // 添加克隆到临时容器
    tempContainer.appendChild(clone);
    
    // 获取内容的实际尺寸
    const bcr = clone.getBoundingClientRect();
    const width = bcr.width;
    const height = bcr.height;
    
    return {
        clone: clone,
        container: tempContainer,
        width: width,
        height: height
    };
}

// 清理导出后的临时元素
function cleanupExport(exportElements) {
    if (exportElements && exportElements.container) {
        document.body.removeChild(exportElements.container);
    }
}

// 导出为PNG
function exportAsPng() {
    // 显示加载状态
    showLoading('正在生成图片，请稍候...');
    
    // 创建导出克隆
    const exportElements = createExportClone();
    if (!exportElements) {
        hideLoading();
        alert('无法导出图片，请先生成族谱');
        return;
    }
    
    // 为html2canvas设置精确尺寸
    const options = {
        backgroundColor: "#ffffff",
        scale: 2, // 提高分辨率
        useCORS: true,
        logging: false,
        allowTaint: true,
        width: exportElements.width,
        height: exportElements.height
    };
    
    setTimeout(() => {
        html2canvas(exportElements.clone, options).then(canvas => {
            // 清理临时元素
            cleanupExport(exportElements);
            hideLoading();
            
            // 创建下载链接
            const link = document.createElement('a');
            link.download = '家族族谱.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('生成图片失败：', error);
            cleanupExport(exportElements);
            hideLoading();
            alert('生成图片失败，请稍后再试');
        });
    }, 100); // 短暂延迟以确保DOM完全渲染
}

// 导出为PDF
function exportAsPdf() {
    // 检查jsPDF是否可用
    if (!jsPDF) {
        alert('PDF导出功能不可用，请确保您的浏览器已加载jsPDF库');
        return;
    }

    // 显示加载状态
    showLoading('正在生成PDF，请稍候...');
    
    // 创建导出克隆
    const exportElements = createExportClone();
    if (!exportElements) {
        hideLoading();
        alert('无法导出PDF，请先生成族谱');
        return;
    }
    
    // 为html2canvas设置精确尺寸
    const options = {
        backgroundColor: "#ffffff",
        scale: 2, // 提高分辨率
        useCORS: true,
        logging: false,
        allowTaint: true,
        width: exportElements.width,
        height: exportElements.height
    };
    
    setTimeout(() => {
        html2canvas(exportElements.clone, options).then(canvas => {
            // 清理临时元素
            cleanupExport(exportElements);
            hideLoading();
            
            // 确定PDF方向和大小
            const imgWidth = exportElements.width;
            const imgHeight = exportElements.height;
            
            let pdfWidth, pdfHeight, orientation;
            
            // 根据内容比例确定PDF方向和尺寸
            if (imgWidth > imgHeight) {
                orientation = 'landscape';
                // 最大宽度为A4横向宽度（297mm）
                const maxWidth = 297;
                // 根据图像比例计算高度
                pdfWidth = maxWidth;
                pdfHeight = (imgHeight * maxWidth) / imgWidth;
                
                // 确保不超过A4高度（210mm）
                if (pdfHeight > 210) {
                    const scale = 210 / pdfHeight;
                    pdfWidth *= scale;
                    pdfHeight = 210;
                }
            } else {
                orientation = 'portrait';
                // 最大高度为A4纵向高度（297mm）
                const maxHeight = 297;
                // 根据图像比例计算宽度
                pdfHeight = maxHeight;
                pdfWidth = (imgWidth * maxHeight) / imgHeight;
                
                // 确保不超过A4宽度（210mm）
                if (pdfWidth > 210) {
                    const scale = 210 / pdfWidth;
                    pdfHeight *= scale;
                    pdfWidth = 210;
                }
            }
            
            // 创建适当尺寸的PDF
            let pdf;
            try {
                pdf = new jsPDF({
                    orientation: orientation,
                    unit: 'mm',
                    format: [pdfWidth + 20, pdfHeight + 20] // 添加边距
                });
            } catch (e) {
                console.error('创建PDF实例失败:', e);
                hideLoading();
                alert('创建PDF失败，请确保jsPDF库正确加载');
                return;
            }
            
            // 图像在PDF中的位置（居中）
            const xPos = 10;
            const yPos = 10;
            
            // 将图像添加到PDF
            pdf.addImage(
                canvas.toDataURL('image/png'), 
                'PNG', 
                xPos, 
                yPos, 
                pdfWidth, 
                pdfHeight
            );
            
            // 保存PDF
            pdf.save('家族族谱.pdf');
            
        }).catch(error => {
            console.error('生成PDF失败：', error);
            cleanupExport(exportElements);
            hideLoading();
            alert('生成PDF失败，请稍后再试');
        });
    }, 100); // 短暂延迟以确保DOM完全渲染
}

// 显示加载状态
function showLoading(message) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-overlay';
    loadingDiv.style = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    
    const loadingContent = document.createElement('div');
    loadingContent.style = `
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    `;
    
    loadingContent.innerHTML = `
        <div class="loading-spinner" style="
            border: 6px solid #f3f3f3;
            border-top: 6px solid #4CAF50;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            margin: 10px auto;
            animation: spin 2s linear infinite;
        "></div>
        <p style="margin: 10px 0; font-size: 16px;">${message}</p>
    `;
    
    // 添加旋转动画
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    loadingDiv.appendChild(loadingContent);
    document.body.appendChild(loadingDiv);
}

// 隐藏加载状态
function hideLoading() {
    const loadingDiv = document.getElementById('loading-overlay');
    if (loadingDiv) {
        document.body.removeChild(loadingDiv);
    }
}

// 导出为SVG
function exportAsSvg() {
    showLoading('正在生成SVG，请稍候...');
    
    const treeContent = document.getElementById('tree-content');
    if (!treeContent || !treeContent.innerHTML.trim()) {
        hideLoading();
        alert('无法导出SVG，请先生成族谱');
        return;
    }
    
    try {
        // 克隆树内容
        const clone = treeContent.cloneNode(true);
        
        // 创建临时容器
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '100%';
        tempContainer.style.height = 'auto';
        tempContainer.style.background = '#fff';
        tempContainer.style.overflow = 'visible';
        document.body.appendChild(tempContainer);
        
        // 为克隆添加必要的样式
        const style = document.createElement('style');
        style.textContent = `
            .family-tree {
                background: #fff !important;
            }
            .selector-container, .buttons, .controls, .legend {
                display: none !important;
            }
        `;
        clone.insertBefore(style, clone.firstChild);
        tempContainer.appendChild(clone);
        
        // 等待布局完成
        setTimeout(() => {
            // 使用 XMLSerializer 序列化 DOM
            const serializer = new XMLSerializer();
            let svgContent = serializer.serializeToString(clone);
            
            // 添加 SVG 命名空间
            if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
                svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            
            // 添加 XML 声明
            svgContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgContent;
            
            // 清理临时容器
            document.body.removeChild(tempContainer);
            hideLoading();
            
            // 创建下载链接
            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = '家族族谱.svg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error('生成SVG失败：', error);
        hideLoading();
        alert('生成SVG失败，请稍后再试');
    }
}

// 导出为JSON
function exportAsJson() {
    if (!window.familyTreeData || window.familyTreeData.length === 0) {
        alert('没有可导出的数据，请先导入族谱');
        return;
    }
    
    try {
        const data = window.familyTreeData;
        const exportData = {
            metadata: {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                source: 'family-tree-generator',
                totalPersons: data.length,
                generations: calculateGenerations(data)
            },
            persons: data
        };
        
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `家族族谱_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('导出JSON失败：', error);
        alert('导出JSON失败，请稍后再试');
    }
}

// 导入JSON文件
function importFromJson(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const data = JSON.parse(content);
            
            // 验证数据结构
            if (!data.persons || !Array.isArray(data.persons)) {
                alert('JSON 格式错误：缺少 persons 数组');
                return;
            }
            
            // 显示导入预览
            showImportPreview(data);
        } catch (error) {
            console.error('解析JSON失败：', error);
            alert('JSON 解析失败，请检查文件格式');
        }
    };
    
    reader.onerror = function() {
        alert('读取文件失败');
    };
    
    reader.readAsText(file);
}

// 显示导入预览
function showImportPreview(importData) {
    const container = document.getElementById('tree-container');
    if (!container) return;
    
    const persons = importData.persons;
    const metadata = importData.metadata || {};
    
    const previewHtml = `
        <div class="import-preview" style="
            background-color: #fff;
            border: 2px solid #4CAF50;
            border-radius: 8px;
            padding: 20px;
            margin: 20px auto;
            max-width: 600px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        ">
            <h3 style="color: #2e7d32; margin-top: 0; display: flex; align-items: center; gap: 8px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                导入预览
            </h3>
            <div style="display: grid; gap: 10px; margin: 15px 0;">
                <p><strong>数据统计：</strong></p>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>人物总数：<strong>${persons.length}</strong> 人</li>
                    ${metadata.generations ? `<li>世代数：<strong>${metadata.generations}</strong> 代</li>` : ''}
                    <li>导出时间：${metadata.exportedAt ? new Date(metadata.exportedAt).toLocaleString('zh-CN') : '未知'}</li>
                    <li>数据源：${metadata.source || '未知'}</li>
                </ul>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="confirmImport" style="
                    flex: 1;
                    padding: 10px 20px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                ">确认导入</button>
                <button id="cancelImport" style="
                    flex: 1;
                    padding: 10px 20px;
                    background-color: #f5f5f5;
                    color: #666;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">取消</button>
            </div>
        </div>
    `;
    
    container.innerHTML = previewHtml;
    
    // 绑定按钮事件
    document.getElementById('confirmImport').addEventListener('click', async () => {
        window.familyTreeData = persons;
        await generateFamilyTree(persons);
        // 触发文件输入清空
        document.getElementById('excelFile').value = '';
    });
    
    document.getElementById('cancelImport').addEventListener('click', () => {
        container.innerHTML = '';
        document.getElementById('excelFile').value = '';
    });
}

// 计算世代数（用于元数据）

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);
