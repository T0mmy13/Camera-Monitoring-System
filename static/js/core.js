/**
 * core.js - Ядро приложения
 */

const CONSTANTS = {
    ROLE_TABLE_ACCESS: {
        'admin': ['cam_registrators', 'cam_camers', 'cam_camera_report', 'cam_users', 'cam_action_log'],
        'editor': ['cam_registrators', 'cam_camers', 'cam_camera_report'],
        'user': ['cam_camera_report']
    },
    ROLE_EDIT_ACCESS: {
        'admin': ['cam_registrators', 'cam_camers', 'cam_camera_report', 'cam_users'],
        'editor': ['cam_camera_report'],
        'user': []
    },
    COLUMN_NAMES: {
        'registrator_full': 'Регистратор',
        'ip': 'Ip',
        'type': 'Тип',
        'count_ports': 'Кол-во портов',
        'extensions': 'Расширения',
        'comment': 'Примечание',
        'condition': 'Состояние',
        'idreg': 'Регистратор',
        'port': 'Порт',
        'location': 'Расположение',
        'expansion': 'Расширение',
        'id_cam': 'Камера',
        'breakdown': 'Поломка',
        'recording_date': 'Дата записи',
        'username': 'Логин',
        'password': 'Пароль',
        'role': 'Роль',
        'action_date': 'Дата действия',
        'action_time': 'Время действия',
        'user': 'Пользователь',
        'action': 'Действие',
        'table_name': 'Таблица',
        'record_id': 'ID записи',
        'field_name': 'Поле',
        'old_value': 'Было',
        'new_value': 'Стало'
    },
    COLUMN_ORDER: {
        'cam_camers': ['idreg', 'port', 'type', 'location', 'expansion', 'comment'],
        'cam_registrators': ['registrator_full', 'ip', 'type', 'count_ports', 'extensions', 'comment', 'condition'],
        'cam_users': ['username', 'password', 'role'],
        'cam_action_log': ['action_date', 'action_time', 'user', 'action', 'table_name', 'record_id', 'field_name', 'old_value', 'new_value'],
        'cam_camera_report': ['id_cam', 'condition', 'breakdown', 'comment', 'recording_date']
    },
    NO_FILTER_COLUMNS: {
        'cam_registrators': ['registrator_full', 'ip', 'comment'],
        'cam_camers': ['comment', 'idreg', 'port', 'location'],
        'cam_users': ['username', 'password', 'role'],
        'cam_action_log': ['action_date', 'action_time', 'user', 'action', 'table_name', 'record_id', 'field_name', 'old_value', 'new_value'],
        'cam_camera_report': ['id_cam', 'breakdown', 'comment']
    },
    CONDITION_OPTIONS: ['Исправна', 'Частично не исправна', 'Неисправна', 'Отключена', 'Проба'],
    BREAKDOWN_OPTIONS: ['Ч/б', 'Нет изображения', 'Пикселит', 'Помехи', 'Шум', 'Отдаёт фиолетовым', 'Плохая видимость'],
    HIDDEN_COLUMNS: ['id', 'ap', 'id_reg_on_ap', 'version', 'last_editor']
};

const AppState = {
    currentTable: 'cam_camera_report',
    isAdmin: false,
    userRole: 'user',
    currentRecordId: null,
    originalData: [],
    currentFilters: {},
    currentSort: { column: null, order: null },
    camerasCache: {},
    registratorsCache: {},
    currentApFilter: null,
    currentRegistratorFilters: new Set(),
    
    reportFilters: {
        startDate: '',
        endDate: '',
        apFilters: new Set(),
        registratorFilters: new Set(),
        conditionFilters: new Set()
    },
    
    actionLogFilters: {
        startDate: '',
        endDate: '',
        userFilter: '',
        actionFilter: '',
        tableFilter: ''
    },
    
    saveState() {
        try {
            localStorage.setItem('cctv_currentTable', JSON.stringify(this.currentTable));
            const filtersToSave = {
                startDate: this.reportFilters.startDate,
                endDate: this.reportFilters.endDate,
                apFilters: Array.from(this.reportFilters.apFilters),
                registratorFilters: Array.from(this.reportFilters.registratorFilters),
                conditionFilters: Array.from(this.reportFilters.conditionFilters)
            };
            localStorage.setItem('cctv_reportFilters', JSON.stringify(filtersToSave));
            localStorage.setItem('cctv_currentSort', JSON.stringify(this.currentSort));
            localStorage.setItem('cctv_currentApFilter', this.currentApFilter === null ? 'null' : String(this.currentApFilter));
            localStorage.setItem('cctv_currentRegistratorFilters', JSON.stringify(Array.from(this.currentRegistratorFilters)));
            localStorage.setItem('cctv_currentFilters', JSON.stringify(this.currentFilters));
            localStorage.setItem('cctv_actionLogFilters', JSON.stringify(this.actionLogFilters));
        } catch(e) {
            console.error('Error saving state:', e);
        }
    },
    
    loadState() {
        try {
            const savedTable = localStorage.getItem('cctv_currentTable');
            if (savedTable) {
                const parsed = JSON.parse(savedTable);
                const availableTables = CONSTANTS.ROLE_TABLE_ACCESS[this.userRole] || [];
                if (availableTables.includes(parsed)) {
                    this.currentTable = parsed;
                }
            }
            const savedReportFilters = localStorage.getItem('cctv_reportFilters');
            if (savedReportFilters) {
                const parsed = JSON.parse(savedReportFilters);
                this.reportFilters.startDate = parsed.startDate || '';
                this.reportFilters.endDate = parsed.endDate || '';
                this.reportFilters.apFilters = new Set(parsed.apFilters || []);
                this.reportFilters.registratorFilters = new Set(parsed.registratorFilters || []);
                this.reportFilters.conditionFilters = new Set(parsed.conditionFilters || []);
            }
            const savedSort = localStorage.getItem('cctv_currentSort');
            if (savedSort) this.currentSort = JSON.parse(savedSort);
            const savedApFilter = localStorage.getItem('cctv_currentApFilter');
            if (savedApFilter && savedApFilter !== 'null') {
                this.currentApFilter = parseInt(savedApFilter);
            } else {
                this.currentApFilter = null;
            }
            const savedRegFilters = localStorage.getItem('cctv_currentRegistratorFilters');
            if (savedRegFilters) {
                this.currentRegistratorFilters = new Set(JSON.parse(savedRegFilters));
            }
            const savedFilters = localStorage.getItem('cctv_currentFilters');
            if (savedFilters) this.currentFilters = JSON.parse(savedFilters);
            const savedActionLogFilters = localStorage.getItem('cctv_actionLogFilters');
            if (savedActionLogFilters) {
                this.actionLogFilters = { ...this.actionLogFilters, ...JSON.parse(savedActionLogFilters) };
            }
        } catch(e) {
            console.error('Error loading state:', e);
        }
    }
};

const API = {
    async fetchData(tableName, id = null) {
        const url = id ? `/api/data/${tableName}/${id}` : `/api/data/${tableName}`;
        const response = await fetch(url);
        return response.json();
    },
    async saveData(tableName, id, data) {
        const response = await fetch(`/api/data/${tableName}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    async deleteData(tableName, id) {
        const response = await fetch(`/api/data/${tableName}/${id}`, { method: 'DELETE' });
        return response.json();
    },
    async createData(tableName, data) {
        const response = await fetch(`/api/data/${tableName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    async loadCamerasCache() {
        const response = await fetch('/api/public/cameras');
        const data = await response.json();
        AppState.camerasCache = {};
        data.forEach(cam => { AppState.camerasCache[cam.id] = cam; });
        return AppState.camerasCache;
    },
    async loadRegistratorsCache() {
        const response = await fetch('/api/public/registrators');
        const data = await response.json();
        AppState.registratorsCache = {};
        data.forEach(reg => {
            AppState.registratorsCache[reg.id] = `АП${reg.ap}_${reg.id_reg_on_ap}`;
        });
        return data;
    }
};

const UI = {
    showMessage(text, type) {
        const msg = document.getElementById('message');
        if (!msg) return;
        msg.textContent = text;
        msg.className = `message ${type}`;
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 3000);
    },
    closeModal() {
        const modal = document.getElementById('modal');
        if (modal) modal.style.display = 'none';
    },
    getTodayDate() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    },
    formatDateToDMY(dateStr) {
        if (!dateStr) return '';
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
            }
        } catch(e) {}
        return dateStr;
    },
    normalizeDate(dateValue) {
        if (!dateValue) return '';
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
        let d = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        if (typeof dateValue === 'string') {
            if (dateValue.includes('T')) return dateValue.split('T')[0];
            if (dateValue.includes(' ')) return dateValue.split(' ')[0];
        }
        return String(dateValue);
    },
    getRegistratorFullName(registrator) {
        return `АП${registrator.ap}_${registrator.id_reg_on_ap}`;
    },
    getUniqueAPsFromCache() {
        const aps = new Set();
        Object.values(AppState.registratorsCache).forEach(regName => {
            const match = regName.match(/АП(\d+)_/);
            if (match) aps.add(parseInt(match[1]));
        });
        return Array.from(aps).sort((a, b) => a - b);
    },
    getButtonText(tableName) {
        const names = {
            'cam_registrators': 'Регистраторы',
            'cam_camers': 'Камеры',
            'cam_camera_report': 'Отчеты',
            'cam_users': 'Пользователи',
            'cam_action_log': 'Журнал действий'
        };
        return names[tableName] || tableName;
    },
    canEditCurrentTable() {
        const editTables = CONSTANTS.ROLE_EDIT_ACCESS[AppState.userRole] || [];
        return editTables.includes(AppState.currentTable);
    },
    canViewTable(tableName) {
        const availableTables = CONSTANTS.ROLE_TABLE_ACCESS[AppState.userRole] || [];
        return availableTables.includes(tableName);
    },
    initUserRole() {
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            AppState.userRole = userInfo.dataset.role;
            AppState.isAdmin = (AppState.userRole === 'admin');
        }
    },
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

window.CCTV = window.CCTV || {};
window.CCTV.Constants = CONSTANTS;
window.CCTV.AppState = AppState;
window.CCTV.API = API;
window.CCTV.UI = UI;