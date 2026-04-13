// IndexedDB 本地存储封装
// 使用原生 IndexedDB API，无额外依赖

class FamilyTreeDB {
    constructor() {
        this.dbName = 'FamilyTreeDB';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * 初始化数据库
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建 projects 对象存储
                if (!db.objectStoreNames.contains('projects')) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
                    projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    projectsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 创建 projectData 对象存储
                if (!db.objectStoreNames.contains('projectData')) {
                    const projectDataStore = db.createObjectStore('projectData', { keyPath: 'projectId' });
                    projectDataStore.createIndex('lastSaved', 'lastSaved', { unique: false });
                }

                // 创建 versions 对象存储（版本历史）
                if (!db.objectStoreNames.contains('versions')) {
                    const versionsStore = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
                    versionsStore.createIndex('projectId', 'projectId', { unique: false });
                    versionsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                console.log('✅ IndexedDB 数据库升级完成');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ IndexedDB 数据库连接成功');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('❌ IndexedDB 连接失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 保存项目（创建或更新）
     * @param {Object} project - 项目元数据 { id, name, ... }
     * @param {Array} data - 族谱数据
     * @param {boolean} createVersion - 是否创建版本快照
     * @returns {Promise<string>} 项目 ID
     */
    async saveProject(project, data, createVersion = true) {
        const timestamp = Date.now();

        // 生成项目 ID（如果是新项目）
        if (!project.id) {
            project.id = `project_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
            project.createdAt = timestamp;
        }
        project.updatedAt = timestamp;

        const tx = this.db.transaction(['projects', 'projectData', 'versions'], 'readwrite');

        // 保存项目元数据
        const projectsStore = tx.objectStore('projects');
        projectsStore.put(project);

        // 保存项目数据
        const projectDataStore = tx.objectStore('projectData');
        projectDataStore.put({
            projectId: project.id,
            data: data,
            lastSaved: timestamp,
            version: (project.version || 0) + 1
        });

        // 创建版本快照
        if (createVersion) {
            const versionsStore = tx.objectStore('versions');
            versionsStore.add({
                projectId: project.id,
                data: data,
                createdAt: timestamp,
                description: `自动保存 ${new Date(timestamp).toLocaleString('zh-CN')}`
            });
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(project.id);
            tx.onerror = (e) => reject(e.error);
        });
    }

    /**
     * 列出所有项目
     * @returns {Promise<Array>} 项目列表
     */
    async listProjects() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const index = store.index('updatedAt');
            const request = index.openCursor(null, 'prev'); // 按更新时间倒序

            const projects = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    projects.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(projects);
                }
            };
            request.onerror = (e) => reject(e.error);
        });
    }

    /**
     * 加载项目数据
     * @param {string} projectId - 项目 ID
     * @returns {Promise<{project: Object, data: Array}>}
     */
    async loadProject(projectId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['projects', 'projectData'], 'readonly');
            const projectsStore = tx.objectStore('projects');
            const projectDataStore = tx.objectStore('projectData');

            // 获取项目元数据
            const projectRequest = projectsStore.get(projectId);
            projectRequest.onsuccess = () => {
                const project = projectRequest.result;
                if (!project) {
                    reject(new Error('项目不存在'));
                    return;
                }

                // 获取项目数据
                const dataRequest = projectDataStore.get(projectId);
                dataRequest.onsuccess = () => {
                    const projectData = dataRequest.result;
                    resolve({
                        project,
                        data: projectData ? projectData.data : null
                    });
                };
                dataRequest.onerror = (e) => reject(e.error);
            };
            projectRequest.onerror = (e) => reject(e.error);
        });
    }

    /**
     * 删除项目（级联删除数据+版本）
     * @param {string} projectId - 项目 ID
     */
    async deleteProject(projectId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['projects', 'projectData', 'versions'], 'readwrite');

            tx.objectStore('projects').delete(projectId);
            tx.objectStore('projectData').delete(projectId);

            // 删除所有版本
            const versionsStore = tx.objectStore('versions');
            const index = versionsStore.index('projectId');
            const request = index.openCursor(IDBKeyRange.only(projectId));
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.error);
        });
    }

    /**
     * 创建版本快照
     * @param {string} projectId - 项目 ID
     * @param {Array} data - 数据
     * @param {string} description - 版本描述
     */
    async createVersion(projectId, data, description = '手动保存') {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('versions', 'readwrite');
            const store = tx.objectStore('versions');

            store.add({
                projectId: projectId,
                data: data,
                createdAt: Date.now(),
                description: description
            });

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.error);
        });
    }

    /**
     * 获取项目的版本历史
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Array>} 版本列表（按时间倒序）
     */
    async getVersions(projectId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('versions', 'readonly');
            const store = tx.objectStore('versions');
            const index = store.index('projectId');
            const request = index.openCursor(IDBKeyRange.only(projectId), 'prev');

            const versions = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    versions.push({
                        id: cursor.value.id,
                        ...cursor.value
                    });
                    cursor.continue();
                } else {
                    resolve(versions);
                }
            };
            request.onerror = (e) => reject(e.error);
        });
    }

    /**
     * 恢复指定版本
     * @param {number} versionId - 版本 ID
     * @returns {Promise<{projectId: string, data: Array}>}
     */
    async restoreVersion(versionId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('versions', 'readonly');
            const store = tx.objectStore('versions');
            const request = store.get(versionId);

            request.onsuccess = () => {
                const version = request.result;
                if (!version) {
                    reject(new Error('版本不存在'));
                    return;
                }

                resolve({
                    projectId: version.projectId,
                    data: version.data
                });
            };
            request.onerror = (e) => reject(e.error);
        });
    }
}

// 导出单例
export const familyDB = new FamilyTreeDB();
export default familyDB;
