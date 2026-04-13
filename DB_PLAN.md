# IndexedDB 本地存储 - 实施计划

> 创建：2026-04-13
> 状态：进行中
> 优先级：🔴 高

---

## 🎯 **目标**

- ✅ 防刷新数据丢失（自动保存）
- ✅ 项目列表管理（多项目支持）
- ✅ 版本历史（可回滚）
- ✅ 离线可用
- ✅ 与 JSON 导入导出无缝集成

---

## 🗃️ **数据库 Schema**

### 1. projects（项目元数据）
```javascript
{
  id: string,           // UUID 或时间戳
  name: string,         // 项目名称（自动生成："家族族谱 2026-04-13"）
  createdAt: number,    // 时间戳
  updatedAt: number,    // 最后修改时间
  thumbnail?: string,   // 可选：SVG 缩略图（base64）
  personCount: number   // 人物数量
}
```

### 2. projectData（项目数据）
```javascript
{
  projectId: string,    // 关联 projects.id
  data: array,          // 完整族谱数据（persons 数组）
  lastSaved: number,    // 保存时间戳
  version: number       // 版本号（递增）
}
```

### 3. versions（版本历史）
```javascript
{
  id: string,           // 版本 ID
  projectId: string,    // 关联项目
  data: array,          // 该版本的完整数据
  createdAt: number,    // 创建时间
  description: string   // 版本描述（如："编辑了张三的姓名"）
}
```

---

## 🔧 **实现步骤**

### 步骤 1：创建数据库封装 `db.js`

```javascript
// db.js - IndexedDB 封装
class FamilyTreeDB {
    constructor() {
        this.dbName = 'FamilyTreeDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建对象存储
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('projectData')) {
                    db.createObjectStore('projectData', { keyPath: 'projectId' });
                }
                if (!db.objectStoreNames.contains('versions')) {
                    const versionsStore = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
                    versionsStore.createIndex('projectId', 'projectId', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 保存项目
    async saveProject(project) {
        // 实现细节...
    }

    // 列出所有项目
    async listProjects() {
        // 实现细节...
    }

    // 加载项目数据
    async loadProject(projectId) {
        // 实现细节...
    }

    // 删除项目
    async deleteProject(projectId) {
        // 实现细节...
    }

    // 创建版本快照
    async createVersion(projectId, data, description) {
        // 实现细节...
    }

    // 获取版本历史
    async getVersions(projectId) {
        // 实现细节...
    }

    // 恢复版本
    async restoreVersion(versionId) {
        // 实现细节...
    }
}

export const familyDB = new FamilyTreeDB();
```

---

### 步骤 2：集成到 `core.js`

1. **初始化**：应用启动时 `await familyDB.init()`
2. **自动保存**：
   ```javascript
   let autoSaveTimer;
   function scheduleAutoSave() {
       clearTimeout(autoSaveTimer);
       autoSaveTimer = setTimeout(saveCurrentProject, 1000);
   }
   ```
3. **触发时机**：
   - 编辑保存后（`saveEdit()`）
   - 上传新 Excel 后（`handleFileUpload()`）
   - 切换根节点后（可选）

---

### 步骤 3：UI 集成

**添加侧边栏/浮动按钮**：
```
[项目列表] ▼
  ├─ 家族族谱 2026-04-13 (3 人)
  ├─ 父系家族 (15 人)
  └─ + 新建项目

[版本历史] ▼
  ├─ 今天 14:30 - 编辑了张三
  ├─ 今天 13:20 - 初始导入
```

**实现方式**：
- 在 `.container` 侧边添加 `<aside id="project-sidebar">`
- 或使用浮动面板（右上角按钮切换）

---

### 步骤 4：导入/导出增强

**导入 JSON 时**：
1. 解析 JSON 数据
2. 提示用户："创建新项目还是覆盖当前项目？"
3. 创建项目记录，保存数据

**导出 JSON 时**：
1. 从数据库读取当前项目元数据
2. 附加到导出的 JSON 中
3. 便于后续导入恢复项目上下文

---

## 📝 **详细实现**

### 1. 数据库封装（db.js）

**完整代码结构**：
```javascript
class FamilyTreeDB {
    constructor() {
        this.dbName = 'FamilyTreeDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        // open indexedDB
        // 创建 object stores
    }

    async saveProject(project) {
        const tx = this.db.transaction(['projects', 'projectData'], 'readwrite');
        // 保存 projects 和 projectData
    }

    async listProjects() {
        // 返回 projects 数组（按 updatedAt 倒序）
    }

    async loadProject(projectId) {
        // 返回 { project, data }
    }

    async deleteProject(projectId) {
        // 级联删除 projectData 和 versions
    }

    async createVersion(projectId, data, description) {
        // 插入 versions 表
    }

    async getVersions(projectId) {
        // 返回版本列表（按时间倒序）
    }

    async restoreVersion(versionId) {
        // 恢复版本到 projectData
    }
}
```

---

## ⚡ **优化策略**

1. **防抖保存**：编辑后 1 秒自动保存，避免频繁写入
2. **懒加载版本**：版本列表默认只显示最近 10 条
3. **缩略图生成**：可选，使用 canvas 截取族谱区域生成 base64
4. **压缩存储**：大数据集使用 gzip（IndexedDB 原生不支持，需 preprocess）

---

## 🧪 **测试计划**

1. 基本 CRUD：创建 → 读取 → 更新 → 删除
2. 自动保存：编辑后检查数据库写入
3. 版本历史：创建 3 个版本，恢复中间版本
4. 多项目切换：保存 2 个项目，切换加载
5. 数据完整性：刷新页面后数据仍存在

---

## 🚀 **实施顺序**

1. ✅ 创建 `db.js` - 数据库封装
2. ✅ 修改 `core.js` - 集成自动保存
3. ✅ 添加 UI - 项目列表侧边栏
4. ✅ 版本历史面板
5. ✅ 导入/导出增强
6. ✅ 测试和优化

**预估工时**：2 天（8-10 小时）

---

## ❓ **设计决策**

**Q: 用原生 IndexedDB 还是 Dexie？**
- 原生：无依赖，但 API 繁琐，易出错
- Dexie：简洁，但增加 20KB 依赖
**建议**：先用原生，稳定后考虑迁移到 Dexie

**Q: 存储上限？**
IndexedDB 通常 50% 磁盘空间，对族谱数据足够（万人级）

**Q: 数据迁移？**
版本 1 → 2 时提供迁移脚本（upgradeneeded 事件处理）

---

开始编码吗？我先创建 `db.js` 基础结构。
