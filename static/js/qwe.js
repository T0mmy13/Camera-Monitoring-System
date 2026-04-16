let currentTable = 'cam_camera_report';
let isAdmin = false;
let userRole = 'user';
let currentRecordId = null;
let originalData = [];
let currentFilters = {};
let currentSort = { column: null, order: null };
let camerasCache = {};
let registratorsCache = {};
let currentApFilter = null;
let currentRegistratorFilters = new Set();

let currentEditVersion = null;
let currentLockInterval = null;
let currentEditId = null;
let currentEditTable = null;

let reportFilters = {
    startDate: '',
    endDate: '',
    apFilters: new Set(),
    registratorFilters: new Set(),
    conditionFilters: new Set()
};

let actionLogFilters = {
    startDate: '',
    endDate: '',
    userFilter: '',
    actionFilter: '',
    tableFilter: ''
};

const STORAGE_KEYS = {
    CURRENT_TABLE: 'cctv_current_table',
    CURRENT_FILTERS: 'cctv_current_filters',
    CURRENT_SORT: 'cctv_current_sort',
    CURRENT_AP_FILTER: 'cctv_current_ap_filter',
    CURRENT_REGISTRATOR_FILTERS: 'cctv_current_registrator_filters',
    REPORT_FILTERS: 'cctv_report_filters',
    ACTION_LOG_FILTERS: 'cctv_action_log_filters'
};

const roleTableAccess = {
    'admin': ['cam_registrators', 'cam_camers', 'cam_camera_report', 'cam_users', 'cam_action_log'],
    'editor': ['cam_registrators', 'cam_camers', 'cam_camera_report'],
    'user': ['cam_camera_report']
};

const roleEditAccess = {
    'admin': ['cam_registrators', 'cam_camers', 'cam_camera_report', 'cam_users'],
    'editor': ['cam_camera_report'],
    'user': []
};

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_TABLE, currentTable);
        const filtersToSave = {
            startDate: reportFilters.startDate,
            endDate: reportFilters.endDate,
            apFilters: Array.from(reportFilters.apFilters),
            registratorFilters: Array.from(reportFilters.registratorFilters),
            conditionFilters: Array.from(reportFilters.conditionFilters)
        };
        localStorage.setItem(STORAGE_KEYS.REPORT_FILTERS, JSON.stringify(filtersToSave));
        localStorage.setItem(STORAGE_KEYS.CURRENT_SORT, JSON.stringify(currentSort));
        localStorage.setItem(STORAGE_KEYS.CURRENT_AP_FILTER, currentApFilter === null ? 'null' : String(currentApFilter));
        localStorage.setItem(STORAGE_KEYS.CURRENT_REGISTRATOR_FILTERS, JSON.stringify(Array.from(currentRegistratorFilters)));
        const commonFilters = {};
        for (let [key, value] of Object.entries(currentFilters)) {
            commonFilters[key] = value;
        }
        localStorage.setItem(STORAGE_KEYS.CURRENT_FILTERS, JSON.stringify(commonFilters));
        localStorage.setItem(STORAGE_KEYS.ACTION_LOG_FILTERS, JSON.stringify(actionLogFilters));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

function loadState() {
    try {
        const savedTable = localStorage.getItem(STORAGE_KEYS.CURRENT_TABLE);
        const availableTables = roleTableAccess[userRole] || [];
        if (savedTable && availableTables.includes(savedTable)) {
            currentTable = savedTable;
        } else {
            if (availableTables.length > 0) {
                currentTable = availableTables[0];
            } else {
                currentTable = 'cam_camera_report';
            }
        }
        const savedReportFilters = localStorage.getItem(STORAGE_KEYS.REPORT_FILTERS);
        if (savedReportFilters) {
            const parsed = JSON.parse(savedReportFilters);
            reportFilters.startDate = parsed.startDate || '';
            reportFilters.endDate = parsed.endDate || '';
            reportFilters.apFilters = new Set(parsed.apFilters || []);
            reportFilters.registratorFilters = new Set(parsed.registratorFilters || []);
            reportFilters.conditionFilters = new Set(parsed.conditionFilters || []);
        }
        const savedSort = localStorage.getItem(STORAGE_KEYS.CURRENT_SORT);
        if (savedSort) {
            currentSort = JSON.parse(savedSort);
        }
        const savedApFilter = localStorage.getItem(STORAGE_KEYS.CURRENT_AP_FILTER);
        if (savedApFilter && savedApFilter !== 'null') {
            currentApFilter = parseInt(savedApFilter);
        } else {
            currentApFilter = null;
        }
        const savedRegFilters = localStorage.getItem(STORAGE_KEYS.CURRENT_REGISTRATOR_FILTERS);
        if (savedRegFilters) {
            const parsed = JSON.parse(savedRegFilters);
            currentRegistratorFilters = new Set(parsed);
        }
        const savedFilters = localStorage.getItem(STORAGE_KEYS.CURRENT_FILTERS);
        if (savedFilters) {
            currentFilters = JSON.parse(savedFilters);
        }
        const savedActionLogFilters = localStorage.getItem(STORAGE_KEYS.ACTION_LOG_FILTERS);
        if (savedActionLogFilters) {
            const parsed = JSON.parse(savedActionLogFilters);
            actionLogFilters = { ...actionLogFilters, ...parsed };
        }
    } catch (e) {
        console.error('Error loading state:', e);
    }
}

const columnNames = {
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
};

const columnOrder = {
    'cam_camers': ['idreg', 'port', 'type', 'location', 'expansion', 'comment'],
    'cam_registrators': ['registrator_full', 'ip', 'type', 'count_ports', 'extensions', 'comment', 'condition'],
    'cam_users': ['username', 'password', 'role'],
    'cam_action_log': ['action_date', 'action_time', 'user', 'action', 'table_name', 'record_id', 'field_name', 'old_value', 'new_value'],
    'cam_camera_report': ['id_cam', 'condition', 'breakdown', 'comment', 'recording_date']
};

// Отключаем сортировку для всех таблиц (убираем возможность сортировки)
const noSortColumns = {
    'cam_camers': ['idreg', 'port', 'type', 'location', 'expansion', 'comment'],
    'cam_registrators': ['registrator_full', 'ip', 'type', 'count_ports', 'extensions', 'comment', 'condition'],
    'cam_users': ['username', 'password', 'role'],
    'cam_action_log': ['action_date', 'action_time', 'user', 'action', 'table_name', 'record_id', 'field_name', 'old_value', 'new_value'],
    'cam_camera_report': ['id_cam', 'condition', 'breakdown', 'comment', 'recording_date']
};

// Фильтры оставляем (кроме таблицы пользователей)
const noFilterColumns = {
    'cam_registrators': ['registrator_full', 'ip', 'comment'],
    'cam_camers': ['comment'],
    'cam_users': ['username', 'password', 'role'],
    'cam_action_log': [],
    'cam_camera_report': ['id_cam', 'breakdown', 'comment']
};

const hiddenColumns = ['id', 'ap', 'id_reg_on_ap', 'version', 'last_editor'];

const conditionOptions = [
    'Исправна',
    'Частично не исправна',
    'Неисправна',
    'Отключена',
    'Проба'
];

const breakdownOptions = [
    'Ч/б',
    'Нет изображения',
    'Пикселит',
    'Помехи',
    'Шум',
    'Отдаёт фиолетовым',
    'Плохая видимость'
];

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showMessage(text, type) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = `message ${type}`;
    msg.style.display = 'block';
    setTimeout(() => {
        msg.style.display = 'none';
    }, 3000);
}

function initUserRole() {
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userRole = userInfo.dataset.role;
        isAdmin = (userRole === 'admin');
        updateTableButtons();
    }
}

function updateTableButtons() {
    const container = document.getElementById('table-selector');
    if (!container) return;
    const availableTables = roleTableAccess[userRole] || [];
    const tableNames = {
        'cam_registrators': 'Регистраторы',
        'cam_camers': 'Камеры',
        'cam_camera_report': 'Отчеты',
        'cam_users': 'Пользователи',
        'cam_action_log': 'Журнал действий'
    };
    let buttonsHtml = '';
    availableTables.forEach(table => {
        buttonsHtml += `<button onclick="loadTable('${table}')">${tableNames[table]}</button>`;
    });
    buttonsHtml += `<button id="resetFiltersBtn" class="reset-filters-btn" onclick="resetAllFilters()">Сбросить фильтры</button>`;
    container.innerHTML = buttonsHtml;
}

function canEditCurrentTable() {
    const editTables = roleEditAccess[userRole] || [];
    return editTables.includes(currentTable);
}

function canViewTable(tableName) {
    const availableTables = roleTableAccess[userRole] || [];
    return availableTables.includes(tableName);
}

function loadCamerasCache() {
    return fetch('/api/public/cameras')
        .then(response => response.json())
        .then(data => {
            camerasCache = {};
            data.forEach(cam => {
                camerasCache[cam.id] = cam;
            });
        })
        .catch(error => console.error('Error loading cameras:', error));
}

function getRegistratorFullName(registrator) {
    return `АП${registrator.ap}_${registrator.id_reg_on_ap}`;
}

function loadRegistratorsCache() {
    return fetch('/api/public/registrators')
        .then(response => response.json())
        .then(data => {
            registratorsCache = {};
            data.forEach(reg => {
                registratorsCache[reg.id] = getRegistratorFullName(reg);
            });
            return data;
        })
        .catch(error => console.error('Error loading registrators:', error));
}

function getUniqueAPs(registrators) {
    const aps = new Set();
    registrators.forEach(reg => {
        aps.add(reg.ap);
    });
    return Array.from(aps).sort((a, b) => a - b);
}

function getUniqueAPsFromCache() {
    const aps = new Set();
    Object.values(registratorsCache).forEach(regName => {
        const match = regName.match(/АП(\d+)_/);
        if (match) {
            aps.add(parseInt(match[1]));
        }
    });
    return Array.from(aps).sort((a, b) => a - b);
}

function displayFilterButtons(registratorsData) {
    const container = document.getElementById('filter-buttons-container');
    if (!container) return;
    if (currentTable === 'cam_registrators') {
        container.style.display = 'flex';
        container.style.flexDirection = 'row';
        container.style.flexWrap = 'wrap';
        container.style.gap = '8px';
        container.style.alignItems = 'center';
        container.style.background = 'white';
        container.style.padding = '12px 15px';
        container.style.borderRadius = '8px';
        container.style.marginBottom = '20px';
        container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        const uniqueAPs = getUniqueAPs(registratorsData);
        let buttonsHtml = '<span class="filter-buttons-title">Фильтр по АП:</span>';
        buttonsHtml += `<button class="filter-btn ${currentApFilter === null ? 'all-active' : ''}" onclick="filterByAP(null)">Все АП</button>`;
        uniqueAPs.forEach(ap => {
            const isActive = currentApFilter === ap;
            buttonsHtml += `<button class="filter-btn ${isActive ? 'active' : ''}" onclick="filterByAP(${ap})">АП${ap}</button>`;
        });
        container.innerHTML = buttonsHtml;
    } 
    else if (currentTable === 'cam_camers') {
        container.style.display = 'flex';
        container.style.flexDirection = 'row';
        container.style.flexWrap = 'wrap';
        container.style.gap = '8px';
        container.style.alignItems = 'center';
        container.style.background = 'white';
        container.style.padding = '12px 15px';
        container.style.borderRadius = '8px';
        container.style.marginBottom = '20px';
        container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        const allSelected = currentRegistratorFilters.size === 0;
        let buttonsHtml = '<span class="filter-buttons-title">Фильтр по регистраторам:</span>';
        buttonsHtml += `<button class="filter-btn ${allSelected ? 'all-active' : ''}" onclick="toggleRegistratorFilter(null)">Все регистраторы</button>`;
        registratorsData.forEach(reg => {
            const fullName = getRegistratorFullName(reg);
            const isActive = currentRegistratorFilters.has(reg.id);
            buttonsHtml += `<button class="filter-btn ${isActive ? 'active' : ''}" onclick="toggleRegistratorFilter(${reg.id})">${fullName}</button>`;
        });
        container.innerHTML = buttonsHtml;
    }
    else if (currentTable === 'cam_camera_report') {
        container.style.display = 'block';
        container.style.background = 'transparent';
        container.style.padding = '0';
        container.style.borderRadius = '0';
        container.style.marginBottom = '20px';
        container.style.boxShadow = 'none';
        if (Object.keys(registratorsCache).length === 0) {
            loadRegistratorsCache().then(() => {
                buildReportFiltersUI(registratorsData || []);
            });
        } else {
            buildReportFiltersUI(registratorsData || []);
        }
    }
    else if (currentTable === 'cam_action_log') {
        container.style.display = 'block';
        container.style.background = 'transparent';
        container.style.padding = '0';
        container.style.borderRadius = '0';
        container.style.marginBottom = '20px';
        container.style.boxShadow = 'none';
        buildActionLogFiltersUI();
    }
    else {
        container.style.display = 'none';
    }
}

function normalizeDate(dateValue) {
    if (!dateValue) return '';
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
    }
    let d;
    if (dateValue instanceof Date) {
        d = dateValue;
    } else {
        d = new Date(dateValue);
    }
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) return dateValue.split('T')[0];
        if (dateValue.includes(' ')) return dateValue.split(' ')[0];
        return dateValue;
    }
    return String(dateValue);
}

function formatDateToDMY(dateStr) {
    if (!dateStr) return '';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
    let parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        }
    } catch(e) {}
    return dateStr;
}

function formatCameraDisplay(cam, reportFilters) {
    if (!cam) return '—';
    const regFullName = registratorsCache[cam.idreg];
    if (!regFullName) return `CAM${cam.port}`;
    const match = regFullName.match(/АП(\d+)_(\d+)/);
    if (!match) return `CAM${cam.port}`;
    const apNumber = match[1];
    const regNumber = match[2];
    const camPort = cam.port;
    const apFilterActive = reportFilters.apFilters.size > 0;
    const regFilterActive = reportFilters.registratorFilters.size > 0;
    if (apFilterActive && regFilterActive) return `${camPort}`;
    else if (apFilterActive && !regFilterActive) return `${regNumber}_${camPort}`;
    else return `АП${apNumber}_${regNumber}_${camPort}`;
}

async function getLastCameraReport(cameraId) {
    try {
        const response = await fetch(`/api/data/cam_camera_report`);
        const data = await response.json();
        const cameraReports = data.data
            .filter(report => report.id_cam == cameraId)
            .sort((a, b) => new Date(b.recording_date) - new Date(a.recording_date));
        if (cameraReports.length > 0) {
            return cameraReports[0];
        }
        return null;
    } catch (error) {
        console.error('Error getting last report:', error);
        return null;
    }
}

async function updateCamerasByRegistratorWithFilter() {
    const registratorSelect = document.getElementById('registrator-select');
    const cameraSelect = document.getElementById('camera-select');
    const hideTodayCheckbox = document.getElementById('hide-today-cameras');
    const selectedRegId = registratorSelect.value;
    if (!selectedRegId) {
        cameraSelect.innerHTML = '<option value="">Сначала выберите регистратор</option>';
        return;
    }
    const today = getTodayDate();
    fetch('/api/data/cam_camers')
        .then(response => response.json())
        .then(async data => {
            let filteredCams = data.data.filter(cam => cam.idreg == selectedRegId);
            if (hideTodayCheckbox && hideTodayCheckbox.checked) {
                const camerasWithTodayReports = new Set();
                const reportsResponse = await fetch('/api/data/cam_camera_report');
                const reportsData = await reportsResponse.json();
                reportsData.data.forEach(report => {
                    const reportDate = normalizeDate(report.recording_date);
                    if (reportDate === today) {
                        camerasWithTodayReports.add(report.id_cam);
                    }
                });
                filteredCams = filteredCams.filter(cam => !camerasWithTodayReports.has(cam.id));
            }
            let options = '<option value="">Выберите камеру</option>';
            filteredCams.forEach(cam => {
                const location = cam.location || 'без расположения';
                const camName = `CAM${cam.port} (${location})`;
                options += `<option value="${cam.id}">${camName}</option>`;
            });
            cameraSelect.innerHTML = options;
            cameraSelect.onchange = () => showLastReportInfo();
        });
}

async function showLastReportInfo() {
    const showLastReportCheckbox = document.getElementById('show-last-report');
    const cameraSelect = document.getElementById('camera-select');
    const lastReportDiv = document.getElementById('last-report-info');
    if (!showLastReportCheckbox || !showLastReportCheckbox.checked || !cameraSelect.value) {
        if (lastReportDiv) {
            lastReportDiv.style.display = 'none';
        }
        return;
    }
    const cameraId = cameraSelect.value;
    const lastReport = await getLastCameraReport(cameraId);
    if (lastReportDiv) {
        if (lastReport) {
            const date = formatDateToDMY(normalizeDate(lastReport.recording_date));
            let breakdownText = lastReport.breakdown ? ` (${lastReport.breakdown})` : '';
            lastReportDiv.innerHTML = `
                <div style="background: #e9ecef; padding: 8px 12px; border-radius: 4px; margin-top: 10px; font-size: 12px;">
                    <strong>📋 Последняя запись:</strong><br>
                    📅 ${date} | ${lastReport.condition}${breakdownText}<br>
                    📝 ${lastReport.comment || 'без комментария'}
                </div>
            `;
            lastReportDiv.style.display = 'block';
        } else {
            lastReportDiv.innerHTML = `
                <div style="background: #fff3cd; padding: 8px 12px; border-radius: 4px; margin-top: 10px; font-size: 12px;">
                    ℹ️ Нет предыдущих записей для этой камеры
                </div>
            `;
            lastReportDiv.style.display = 'block';
        }
    }
}

function updateRegistratorSelectByAp() {
    const apSelect = document.getElementById('report-ap-select');
    const registratorSelect = document.getElementById('report-registrator-select');
    const selectedAp = apSelect.value ? parseInt(apSelect.value) : null;
    if (!registratorSelect) return;
    reportFilters.registratorFilters.clear();
    if (!selectedAp) {
        registratorSelect.disabled = true;
        registratorSelect.innerHTML = '<option value="">Все регистраторы</option>';
        const textSpan = registratorSelect.parentElement.querySelector('.filter-value-text');
        if (textSpan) textSpan.textContent = '✖ выберите предприятие';
        const badge = registratorSelect.parentElement.querySelector('.filter-badge-mini');
        if (badge) badge.remove();
        displayTable();
        saveState();
        return;
    }
    registratorSelect.disabled = false;
    const filteredRegistrators = Object.entries(registratorsCache)
        .filter(([regId, regName]) => {
            const match = regName.match(/АП(\d+)_/);
            return match && parseInt(match[1]) === selectedAp;
        })
        .map(([regId, regName]) => ({ id: parseInt(regId), name: regName }));
    let options = '<option value="">Все регистраторы</option>';
    filteredRegistrators.forEach(reg => {
        options += `<option value="${reg.id}">${reg.name}</option>`;
    });
    registratorSelect.innerHTML = options;
    const textSpan = registratorSelect.parentElement.querySelector('.filter-value-text');
    if (textSpan) textSpan.textContent = 'Все';
    displayTable();
    saveState();
}

function updateRegistratorFilterFromSelect() {
    const select = document.getElementById('report-registrator-select');
    if (!select || select.disabled) return;
    const value = select.value;
    reportFilters.registratorFilters.clear();
    if (value) {
        reportFilters.registratorFilters.add(parseInt(value));
    }
    const textSpan = select.parentElement.querySelector('.filter-value-text');
    if (textSpan) {
        if (reportFilters.registratorFilters.size === 0) {
            textSpan.textContent = 'Все';
        } else {
            textSpan.textContent = `Выбрано: ${reportFilters.registratorFilters.size}`;
        }
    }
    const badge = select.parentElement.querySelector('.filter-badge-mini');
    if (reportFilters.registratorFilters.size > 0) {
        if (!badge) {
            const span = document.createElement('span');
            span.className = 'filter-badge-mini';
            span.textContent = '✓';
            select.parentElement.appendChild(span);
        }
    } else {
        if (badge) badge.remove();
    }
    displayTable();
    saveState();
}

function buildReportFiltersUI(registratorsData) {
    const container = document.getElementById('filter-buttons-container');
    if (!container) return;
    const today = getTodayDate();
    if (!reportFilters.startDate) {
        reportFilters.startDate = today;
    }
    if (!reportFilters.endDate) {
        reportFilters.endDate = today;
    }
    let allRegistratorsData = registratorsData;
    if (!allRegistratorsData || allRegistratorsData.length === 0) {
        allRegistratorsData = Object.entries(registratorsCache).map(([id, name]) => ({
            id: parseInt(id),
            name: name,
            ap: parseInt(name.match(/АП(\d+)_/)?.[1] || 0)
        }));
    }
    const allAPs = [...new Set(allRegistratorsData.map(reg => reg.ap))].sort((a, b) => a - b);
    const allConditions = conditionOptions;
    const allRegistrators = allRegistratorsData.map(reg => ({
        id: reg.id,
        name: reg.name,
        ap: reg.ap
    }));
    let html = `
        <div class="report-filters-minimal">
            <div class="filter-row">
                <div class="filter-item">
                    <span class="filter-label">📅</span>
                    <input type="date" id="report-start-date" class="date-input-mini" value="${reportFilters.startDate}" max="${today}" onchange="updateReportDateFilter()">
                    <span>—</span>
                    <input type="date" id="report-end-date" class="date-input-mini" value="${reportFilters.endDate}" max="${today}" onchange="updateReportDateFilter()">
                </div>
                <div class="filter-item">
                    <span class="filter-label">🏭 Предприятие</span>
                    <select id="report-ap-select" class="filter-select-mini" onchange="updateApFilterFromSelect()">
                        <option value="">Все</option>
                        ${allAPs.map(ap => 
                            `<option value="${ap}" ${reportFilters.apFilters.has(ap) ? 'selected' : ''}>АП${ap}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="filter-item">
                    <span class="filter-label">🎥 Регистратор</span>
                    <select id="report-registrator-select" class="filter-select-mini" onchange="updateRegistratorFilterFromSelect()" ${reportFilters.apFilters.size === 0 ? 'disabled' : ''}>
                        <option value="">Все</option>
                        ${allRegistrators
                            .filter(reg => reportFilters.apFilters.size === 0 || reportFilters.apFilters.has(reg.ap))
                            .map(reg => 
                                `<option value="${reg.id}" ${reportFilters.registratorFilters.has(reg.id) ? 'selected' : ''}>${reg.name}</option>`
                            ).join('')}
                    </select>
                </div>
                <div class="filter-item">
                    <span class="filter-label">📊 Состояние</span>
                    <select id="report-condition-select" class="filter-select-mini" multiple size="1" onchange="updateConditionFilterFromSelect()">
                        ${allConditions.map(condition => 
                            `<option value="${condition}" ${reportFilters.conditionFilters.has(condition) ? 'selected' : ''}>${condition}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    const apSelect = document.getElementById('report-ap-select');
    if (apSelect) {
        apSelect.addEventListener('change', function() {
            updateRegistratorSelectByAp();
        });
    }
    const selects = container.querySelectorAll('.filter-select-mini');
    selects.forEach(select => {
        if (select.hasAttribute('multiple')) {
            select.addEventListener('focus', function() {
                this.size = Math.min(this.options.length, 6);
            });
            select.addEventListener('blur', function() {
                this.size = 1;
            });
            select.addEventListener('change', function() {
                this.size = 1;
            });
        }
    });
}

function addExportButtonBelowTable() {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    const oldExportBtn = document.getElementById('export-excel-below');
    if (oldExportBtn) oldExportBtn.remove();
    const exportContainer = document.createElement('div');
    exportContainer.id = 'export-excel-below';
    exportContainer.style.cssText = 'text-align: right; margin-top: 15px; padding: 10px;';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📎 Экспорт в Excel';
    exportBtn.className = 'filter-btn';
    exportBtn.style.cssText = 'background: #27ae60; color: white; border-color: #27ae60; padding: 8px 20px; font-size: 14px; cursor: pointer;';
    exportBtn.onclick = function() { exportToExcel(); };
    exportContainer.appendChild(exportBtn);
    tableContainer.parentNode.insertBefore(exportContainer, tableContainer.nextSibling);
}

function updateReportDateFilter() {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    if (startDate && endDate && startDate > endDate) {
        document.getElementById('report-start-date').value = reportFilters.startDate;
        document.getElementById('report-end-date').value = reportFilters.endDate;
        return;
    }
    reportFilters.startDate = startDate;
    reportFilters.endDate = endDate;
    displayTable();
    updateFilterUI();
    saveState();
}

function updateApFilterFromSelect() {
    const select = document.getElementById('report-ap-select');
    const value = select.value;
    reportFilters.apFilters.clear();
    if (value) {
        reportFilters.apFilters.add(parseInt(value));
    }
    displayTable();
    updateFilterUI();
    saveState();
}

function updateConditionFilterFromSelect() {
    const select = document.getElementById('report-condition-select');
    const selectedOptions = Array.from(select.selectedOptions);
    reportFilters.conditionFilters.clear();
    selectedOptions.forEach(opt => {
        const val = opt.value;
        if (val) {
            reportFilters.conditionFilters.add(val);
        }
    });
    displayTable();
    updateFilterUI();
    saveState();
}

function updateFilterUI() {
    const container = document.getElementById('filter-buttons-container');
    if (!container || currentTable !== 'cam_camera_report') return;
    const allAPs = getUniqueAPsFromCache();
    const allConditions = conditionOptions;
    const apSelect = document.getElementById('report-ap-select');
    const conditionSelect = document.getElementById('report-condition-select');
    const registratorSelect = document.getElementById('report-registrator-select');
    if (apSelect) {
        const textSpan = apSelect.parentElement.querySelector('.filter-value-text');
        if (textSpan) {
            if (reportFilters.apFilters.size === 0) {
                textSpan.textContent = 'Все';
            } else if (reportFilters.apFilters.size === allAPs.length) {
                textSpan.textContent = 'Все';
            } else {
                textSpan.textContent = `Выбрано: ${reportFilters.apFilters.size}`;
            }
        }
        const badge = apSelect.parentElement.querySelector('.filter-badge-mini');
        if (reportFilters.apFilters.size > 0) {
            if (!badge) {
                const span = document.createElement('span');
                span.className = 'filter-badge-mini';
                span.textContent = '✓';
                apSelect.parentElement.appendChild(span);
            }
        } else {
            if (badge) badge.remove();
        }
    }
    if (conditionSelect) {
        const textSpan = conditionSelect.parentElement.querySelector('.filter-value-text');
        if (textSpan) {
            if (reportFilters.conditionFilters.size === 0) {
                textSpan.textContent = 'Все';
            } else if (reportFilters.conditionFilters.size === allConditions.length) {
                textSpan.textContent = 'Все';
            } else {
                textSpan.textContent = `Выбрано: ${reportFilters.conditionFilters.size}`;
            }
        }
        const badge = conditionSelect.parentElement.querySelector('.filter-badge-mini');
        if (reportFilters.conditionFilters.size > 0) {
            if (!badge) {
                const span = document.createElement('span');
                span.className = 'filter-badge-mini';
                span.textContent = '✓';
                conditionSelect.parentElement.appendChild(span);
            }
        } else {
            if (badge) badge.remove();
        }
    }
    if (registratorSelect) {
        const textSpan = registratorSelect.parentElement.querySelector('.filter-value-text');
        if (textSpan) {
            if (reportFilters.registratorFilters.size === 0) {
                textSpan.textContent = 'Все';
            } else {
                textSpan.textContent = `Выбрано: ${reportFilters.registratorFilters.size}`;
            }
        }
        const badge = registratorSelect.parentElement.querySelector('.filter-badge-mini');
        if (reportFilters.registratorFilters.size > 0) {
            if (!badge) {
                const span = document.createElement('span');
                span.className = 'filter-badge-mini';
                span.textContent = '✓';
                registratorSelect.parentElement.appendChild(span);
            }
        } else {
            if (badge) badge.remove();
        }
    }
}

function resetReportFilters() {
    const today = getTodayDate();
    reportFilters = {
        startDate: today,
        endDate: today,
        apFilters: new Set(),
        registratorFilters: new Set(),
        conditionFilters: new Set()
    };
    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    if (startDateInput) startDateInput.value = today;
    if (endDateInput) endDateInput.value = today;
    const apSelect = document.getElementById('report-ap-select');
    if (apSelect) {
        apSelect.value = '';
    }
    const registratorSelect = document.getElementById('report-registrator-select');
    if (registratorSelect) {
        registratorSelect.disabled = true;
        registratorSelect.innerHTML = '<option value="">Все регистраторы</option>';
        const textSpan = registratorSelect.parentElement.querySelector('.filter-value-text');
        if (textSpan) textSpan.textContent = '✖ выберите АП';
    }
    const conditionSelect = document.getElementById('report-condition-select');
    if (conditionSelect) {
        for (let i = 0; i < conditionSelect.options.length; i++) {
            conditionSelect.options[i].selected = false;
        }
        conditionSelect.size = 1;
    }
    displayTable();
    updateFilterUI();
    saveState();
}

function filterByAP(ap) {
    if (currentApFilter === ap) {
        currentApFilter = null;
    } else {
        currentApFilter = ap;
    }
    displayTable();
    saveState();
    const container = document.getElementById('filter-buttons-container');
    if (container && currentTable === 'cam_registrators') {
        const buttons = container.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            if (btn.textContent === 'Все АП') {
                if (currentApFilter === null) {
                    btn.classList.add('all-active');
                    btn.classList.remove('active');
                } else {
                    btn.classList.remove('all-active');
                }
            } else {
                const apNum = parseInt(btn.textContent.replace('АП', ''));
                if (currentApFilter === apNum) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }
}

function toggleRegistratorFilter(registratorId) {
    if (registratorId === null) {
        currentRegistratorFilters.clear();
    } else {
        if (currentRegistratorFilters.has(registratorId)) {
            currentRegistratorFilters.delete(registratorId);
        } else {
            currentRegistratorFilters.add(registratorId);
        }
    }
    displayTable();
    saveState();
    const container = document.getElementById('filter-buttons-container');
    if (container && currentTable === 'cam_camers') {
        const buttons = container.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes('toggleRegistratorFilter')) {
                if (onclickAttr.includes('null')) {
                    if (currentRegistratorFilters.size === 0) {
                        btn.classList.add('all-active');
                        btn.classList.remove('active');
                    } else {
                        btn.classList.remove('all-active');
                    }
                } else {
                    const regIdMatch = onclickAttr.match(/toggleRegistratorFilter\((\d+)\)/);
                    if (regIdMatch) {
                        const regId = parseInt(regIdMatch[1]);
                        if (currentRegistratorFilters.has(regId)) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    }
                }
            }
        });
    }
}

function loadTable(tableName) {
    if (!canViewTable(tableName)) {
        showMessage('У вас нет доступа к этой таблице', 'error');
        return;
    }
    currentTable = tableName;
    currentFilters = {};
    currentSort = { column: null, order: null };
    document.querySelectorAll('.table-selector button').forEach(btn => {
        if (btn.textContent === getButtonText(tableName)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    if (tableName === 'cam_camera_report') {
        const today = getTodayDate();
        if (!reportFilters.startDate && !reportFilters.endDate) {
            reportFilters.startDate = today;
            reportFilters.endDate = today;
        }
        Promise.all([loadCamerasCache(), loadRegistratorsCache()]).then(([_, registratorsData]) => {
            fetch(`/api/data/${tableName}`)
                .then(response => response.json())
                .then(data => {
                    originalData = data.data;
                    displayFilterButtons(registratorsData);
                    displayTable();
                    saveState();
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center; color: red;">Ошибка загрузки данных</p>';
                });
        });
    } else if (tableName === 'cam_registrators') {
        fetch(`/api/data/${tableName}`)
            .then(response => response.json())
            .then(data => {
                originalData = data.data.map(reg => ({
                    ...reg,
                    registrator_full: getRegistratorFullName(reg)
                }));
                displayFilterButtons(data.data);
                displayTable();
                saveState();
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center; color: red;">Ошибка загрузки данных</p>';
            });
    } else if (tableName === 'cam_camers') {
        Promise.all([loadRegistratorsCache()]).then(([registratorsData]) => {
            fetch(`/api/data/${tableName}`)
                .then(response => response.json())
                .then(data => {
                    originalData = data.data;
                    displayFilterButtons(registratorsData);
                    displayTable();
                    saveState();
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center; color: red;">Ошибка загрузки данных</p>';
                });
        });
    } else if (tableName === 'cam_action_log') {
        // Устанавливаем фильтр даты на текущую дату, если он пуст
        const today = getTodayDate();
        if (!actionLogFilters.startDate && !actionLogFilters.endDate) {
            actionLogFilters.startDate = today;
            actionLogFilters.endDate = today;
        }
        loadActionLogFiltersState();
        fetch(`/api/data/${tableName}`)
            .then(response => response.json())
            .then(data => {
                originalData = data.data;
                displayFilterButtons([]);
                buildActionLogFiltersUI();
                displayTable();
                saveState();
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center; color: red;">Ошибка загрузки данных</p>';
            });
    } else {
        fetch(`/api/data/${tableName}`)
            .then(response => response.json())
            .then(data => {
                originalData = data.data;
                displayFilterButtons([]);
                displayTable();
                saveState();
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center; color: red;">Ошибка загрузки данных</p>';
            });
    }
}

function getUniqueValuesForColumn(data, column) {
    if (currentTable === 'cam_action_log' && column === 'time_action') {
        const dates = [...new Set(data.map(row => {
            if (row[column]) {
                return row[column].split(' ')[0];
            }
            return null;
        }).filter(v => v !== null))];
        return dates.sort().reverse();
    }
    if (currentTable === 'cam_registrators' && column === 'registrator_full') {
        return [...new Set(data.map(row => row[column]))]
            .filter(v => v !== null && v !== '')
            .sort((a, b) => {
                const parseReg = (str) => {
                    const match = str.match(/АП(\d+)_(\d+)/);
                    if (match) {
                        return { ap: parseInt(match[1]), id_reg: parseInt(match[2]) };
                    }
                    return { ap: 0, id_reg: 0 };
                };
                const parsedA = parseReg(a);
                const parsedB = parseReg(b);
                if (parsedA.ap !== parsedB.ap) return parsedA.ap - parsedB.ap;
                return parsedA.id_reg - parsedB.id_reg;
            });
    }
    return [...new Set(data.map(row => row[column]))]
        .filter(v => v !== null && v !== '')
        .sort();
}

function applyReportDataFilters(data) {
    if (currentTable !== 'cam_camera_report') return data;
    return data.filter(row => {
        let rowDate = normalizeDate(row.recording_date);
        let passed = true;
        if (passed && reportFilters.startDate && reportFilters.startDate !== '') {
            if (rowDate < reportFilters.startDate) {
                passed = false;
            }
        }
        if (passed && reportFilters.endDate && reportFilters.endDate !== '') {
            if (rowDate > reportFilters.endDate) {
                passed = false;
            }
        }
        const cam = camerasCache[row.id_cam];
        if (!cam) {
            return false;
        }
        if (passed && reportFilters.apFilters.size > 0) {
            let regAp = null;
            for (let [regId, regName] of Object.entries(registratorsCache)) {
                if (regId == cam.idreg) {
                    const match = regName.match(/АП(\d+)_/);
                    if (match) {
                        regAp = parseInt(match[1]);
                    }
                    break;
                }
            }
            if (!regAp || !reportFilters.apFilters.has(regAp)) {
                passed = false;
            }
        }
        if (passed && reportFilters.registratorFilters.size > 0) {
            if (!reportFilters.registratorFilters.has(cam.idreg)) {
                passed = false;
            }
        }
        if (passed && reportFilters.conditionFilters.size > 0) {
            if (!reportFilters.conditionFilters.has(row.condition)) {
                passed = false;
            }
        }
        return passed;
    });
}

function displayTable() {
    let workingData = [...originalData];
    if (currentTable === 'cam_registrators' && currentApFilter !== null) {
        workingData = workingData.filter(reg => reg.ap == currentApFilter);
    }
    if (currentTable === 'cam_camers' && currentRegistratorFilters.size > 0) {
        workingData = workingData.filter(cam => currentRegistratorFilters.has(cam.idreg));
    }
    if (currentTable === 'cam_camera_report') {
        workingData = applyReportDataFilters(workingData);
    }
    if (currentTable === 'cam_action_log') {
        let filtered = [...workingData];
        if (actionLogFilters.startDate) {
            const start = new Date(actionLogFilters.startDate);
            filtered = filtered.filter(row => {
                const [day, month, year] = row.action_date.split('.');
                const rowDate = new Date(`${year}-${month}-${day}`);
                return rowDate >= start;
            });
        }
        if (actionLogFilters.endDate) {
            const end = new Date(actionLogFilters.endDate);
            filtered = filtered.filter(row => {
                const [day, month, year] = row.action_date.split('.');
                const rowDate = new Date(`${year}-${month}-${day}`);
                return rowDate <= end;
            });
        }
        if (actionLogFilters.userFilter) {
            filtered = filtered.filter(row => row.user === actionLogFilters.userFilter);
        }
        if (actionLogFilters.actionFilter) {
            filtered = filtered.filter(row => row.action === actionLogFilters.actionFilter);
        }
        if (actionLogFilters.tableFilter) {
            filtered = filtered.filter(row => row.table_name === actionLogFilters.tableFilter);
        }
        workingData = filtered;
    }
    let filteredData = applyFilters(workingData);
    let sortedData = applySorting(filteredData);
    if (sortedData.length === 0) {
        document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center;">Нет данных</p>';
        return;
    }
    let html = '';
    let columnsToDisplay;
    if (currentTable === 'cam_action_log') {
        columnsToDisplay = columnOrder['cam_action_log'];
    } else if (currentTable === 'cam_camera_report') {
        columnsToDisplay = columnOrder['cam_camera_report'];
    } else if (currentTable === 'cam_users') {
        columnsToDisplay = columnOrder['cam_users'];
    } else if (currentTable === 'cam_registrators') {
        columnsToDisplay = columnOrder['cam_registrators'];
    } else if (currentTable === 'cam_camers') {
        columnsToDisplay = columnOrder['cam_camers'];
    } else {
        columnsToDisplay = Object.keys(sortedData[0] || {}).filter(col => !hiddenColumns.includes(col));
    }
    html += '<table id="data-table">';
    html += '<thead><tr>';
    columnsToDisplay.forEach(col => {
        const displayName = columnNames[col] || col;
        // Для всех таблиц убираем кнопки сортировки, оставляем только текст
        // Но для отчётов оставляем как есть (без сортировки)
        if (currentTable === 'cam_camera_report') {
            html += `<th style="position: relative;">
                <div class="column-btn" style="cursor: default; opacity: 0.7;">
                    ${displayName}
                </div>
            </th>`;
        } else {
            // Убираем возможность сортировки, но оставляем фильтр (клик по заголовку вызывает меню фильтрации)
            const canFilter = !noFilterColumns[currentTable]?.includes(col);
            if (canFilter) {
                html += `<th style="position: relative;">
                    <button class="column-btn" onclick="showColumnMenu(event, '${col}')" style="cursor: pointer;">
                        ${displayName}
                    </button>
                </th>`;
            } else {
                html += `<th style="position: relative;">
                    <div class="column-btn" style="cursor: default; opacity: 0.7;">
                        ${displayName}
                    </div>
                </th>`;
            }
        }
    });
    html += '<tr></thead><tbody>';
    sortedData.forEach(row => {
        html += '<tr data-id="' + row.id + '">';
        columnsToDisplay.forEach(col => {
            let value = row[col];
            if (value === null) value = '';
            if (currentTable === 'cam_users' && col === 'password') {
                html += `<td>••••••</td>`;
                return;
            }
            if (currentTable === 'cam_action_log' && col === 'action') {
                let details = [];
                if (row.table_name) details.push(`Таблица: ${row.table_name}`);
                if (row.record_id) details.push(`ID записи: ${row.record_id}`);
                if (row.field_name) details.push(`Поле: ${row.field_name}`);
                if (row.old_value !== null && row.old_value !== undefined && row.old_value !== '') details.push(`Было: ${row.old_value}`);
                if (row.new_value !== null && row.new_value !== undefined && row.new_value !== '') details.push(`Стало: ${row.new_value}`);
                if (details.length) {
                    value = `${row.action} (${details.join(', ')})`;
                } else {
                    value = row.action;
                }
            }
            if (currentTable === 'cam_registrators' && col === 'ip' && value) {
                let ipValue = value;
                if (ipValue.match(/^(\d{1,3}\.){3}\d{1,3}$/) || ipValue === 'localhost' || ipValue === '127.0.0.1') {
                    html += `<td class="ip-cell">
                        <a href="http://${ipValue}" target="_blank" class="ip-link" onclick="event.stopPropagation()">${ipValue}</a>
                      </td>`;
                } else {
                    html += `<td>${value}</td>`;
                }
            }
            else if (currentTable === 'cam_camers' && col === 'idreg' && value) {
                const regInfo = registratorsCache[value];
                let displayReg = regInfo || `Регистратор #${value}`;
                html += `<td>${displayReg}</td>`;
            }
            else if (currentTable === 'cam_camera_report' && col === 'id_cam' && value) {
                const cam = camerasCache[value];
                if (cam) {
                    const displayValue = formatCameraDisplay(cam, reportFilters);
                    html += `<td>${displayValue}</td>`;
                } else {
                    html += `<td title="ID камеры: ${value}">Камера #${value}</td>`;
                }
            }
            else if (currentTable === 'cam_camera_report' && col === 'recording_date') {
                const formattedDate = formatDateToDMY(value);
                html += `<td>${formattedDate}</td>`;
            }
            else {
                html += `<td>${value}</td>`;
            }
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('table-content').innerHTML = html;
    if (currentTable === 'cam_camera_report') {
        addExportButtonBelowTable();
    } else if (currentTable === 'cam_action_log') {
        addExportButtonForActionLog();
    } else {
        const oldExportBtn = document.getElementById('export-excel-below');
        if (oldExportBtn) oldExportBtn.remove();
    }
    if (userRole === 'user' && currentTable === 'cam_camera_report') {
        const rows = document.querySelectorAll('#data-table tbody tr');
        rows.forEach(row => {
            row.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, true);
            });
        });
        const tableContainerElem = document.querySelector('.table-container');
        if (tableContainerElem) {
            tableContainerElem.addEventListener('contextmenu', function(e) {
                if (!e.target.closest('tr')) {
                    e.preventDefault();
                    showContextMenu(e.clientX, e.clientY, false);
                }
            });
        }
    } 
    else if (canEditCurrentTable()) {
        const rows = document.querySelectorAll('#data-table tbody tr');
        rows.forEach(row => {
            row.addEventListener('dblclick', function(e) {
                e.preventDefault();
                currentRecordId = this.getAttribute('data-id');
                showEditForm(currentRecordId);
            });
            row.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                currentRecordId = this.getAttribute('data-id');
                showContextMenu(e.clientX, e.clientY, true);
            });
        });
        const tableContainerElem = document.querySelector('.table-container');
        if (tableContainerElem) {
            tableContainerElem.addEventListener('contextmenu', function(e) {
                if (!e.target.closest('tr')) {
                    e.preventDefault();
                    showContextMenu(e.clientX, e.clientY, false);
                }
            });
        }
    } else {
        const rows = document.querySelectorAll('#data-table tbody tr');
        rows.forEach(row => {
            row.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                if (currentTable === 'cam_camera_report') {
                    showContextMenu(e.clientX, e.clientY, true);
                }
            });
        });
    }
}

function applyFilters(data) {
    return data.filter(row => {
        for (let [column, filterValue] of Object.entries(currentFilters)) {
            if (filterValue) {
                let rowValue = row[column];
                if (currentTable === 'cam_action_log' && column === 'time_action' && rowValue) {
                    const rowDate = rowValue.split(' ')[0];
                    if (rowDate !== filterValue) {
                        return false;
                    }
                } else if (rowValue != filterValue) {
                    return false;
                }
            }
        }
        return true;
    });
}

function applySorting(data) {
    if (!currentSort.column || !currentSort.order) return data;
    return [...data].sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];
        if (valA === null) valA = '';
        if (valB === null) valB = '';
        if (currentTable === 'cam_registrators' && currentSort.column === 'registrator_full') {
            const parseReg = (str) => {
                const match = str.match(/АП(\d+)_(\d+)/);
                if (match) {
                    return { ap: parseInt(match[1]), id_reg: parseInt(match[2]) };
                }
                return { ap: 0, id_reg: 0 };
            };
            const parsedA = parseReg(valA);
            const parsedB = parseReg(valB);
            if (parsedA.ap !== parsedB.ap) {
                return currentSort.order === 'asc' ? parsedA.ap - parsedB.ap : parsedB.ap - parsedA.ap;
            }
            return currentSort.order === 'asc' ? parsedA.id_reg - parsedB.id_reg : parsedB.id_reg - parsedA.id_reg;
        }
        if (currentTable === 'cam_action_log' && currentSort.column === 'time_action') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
            return currentSort.order === 'asc' ? valA - valB : valB - valA;
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
            return currentSort.order === 'asc' ? valA - valB : valB - valA;
        }
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
        return 0;
    });
}

function showColumnMenu(event, column) {
    if (noFilterColumns[currentTable]?.includes(column)) {
        return;
    }
    event.stopPropagation();
    const existingMenu = document.querySelector('.dropdown-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    const buttonRect = event.target.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.left = buttonRect.left + 'px';
    menu.style.top = (buttonRect.bottom + window.scrollY) + 'px';
    let menuHtml = '';
    // Убираем блок сортировки полностью
    // menuHtml += `<div class="dropdown-header">Фильтр по значению</div>
    //     <div class="dropdown-item" onclick="setFilter('${column}', null)">
    //         Все значения ${!currentFilters[column] ? '✓' : ''}
    //     </div>`;
    // Более простой вариант: показываем только фильтры, без сортировки
    menuHtml = `<div class="dropdown-header">Фильтр по значению</div>
        <div class="dropdown-item" onclick="setFilter('${column}', null)">
            Все значения ${!currentFilters[column] ? '✓' : ''}
        </div>`;
    const uniqueValues = getUniqueValuesForColumn(originalData, column);
    uniqueValues.forEach(value => {
        let filterValue = value;
        let displayValue = value;
        if (currentTable === 'cam_action_log' && column === 'time_action') {
            displayValue = value;
            filterValue = value;
        }
        const isActive = currentFilters[column] === filterValue;
        menuHtml += `<div class="dropdown-item ${isActive ? 'active' : ''}" onclick="setFilter('${column}', '${filterValue.toString().replace(/'/g, "\\'")}')">
            ${displayValue} ${isActive ? '✓' : ''}
        </div>`;
    });
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== event.target) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

function setSort(column, order) {
    if (currentSort.column === column && currentSort.order === order) {
        currentSort = { column: null, order: null };
    } else {
        currentSort = { column, order };
    }
    closeDropdownMenu();
    displayTable();
    saveState();
}

function setFilter(column, value) {
    if (value === null) {
        delete currentFilters[column];
    } else {
        currentFilters[column] = value;
    }
    closeDropdownMenu();
    displayTable();
    saveState();
}

function resetAllFilters() {
    currentFilters = {};
    currentSort = { column: null, order: null };
    currentApFilter = null;
    currentRegistratorFilters.clear();
    const today = getTodayDate();
    reportFilters = {
        startDate: today,
        endDate: today,
        apFilters: new Set(),
        registratorFilters: new Set(),
        conditionFilters: new Set()
    };
    actionLogFilters = {
        startDate: today,
        endDate: today,
        userFilter: '',
        actionFilter: '',
        tableFilter: ''
    };
    displayTable();
    if (currentTable === 'cam_registrators') {
        fetch('/api/data/cam_registrators').then(response => response.json()).then(data => {
            displayFilterButtons(data.data);
        });
    } else if (currentTable === 'cam_camers') {
        loadRegistratorsCache().then(registratorsData => {
            displayFilterButtons(registratorsData);
        });
    } else if (currentTable === 'cam_camera_report') {
        loadRegistratorsCache().then(registratorsData => {
            displayFilterButtons(registratorsData);
        });
    } else if (currentTable === 'cam_action_log') {
        buildActionLogFiltersUI();
    }
    saveState();
}

function closeDropdownMenu() {
    const menu = document.querySelector('.dropdown-menu');
    if (menu) {
        menu.remove();
    }
}

function showContextMenu(x, y, hasRecord) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    let menuHtml = '';
    if (userRole === 'user' && currentTable === 'cam_camera_report') {
        menuHtml = `<div class="context-menu-item" onclick="exportToExcel()">📎 Экспорт в Excel</div>`;
    }
    else if (currentTable === 'cam_action_log') {
        menuHtml = `<div class="context-menu-item" onclick="exportActionLogToExcel()">📎 Экспорт в Excel</div>`;
    }
    else if (canEditCurrentTable()) {
        if (hasRecord) {
            if (userRole === 'admin') {
                menuHtml = `
                    <div class="context-menu-item" onclick="showAddForm()">➕ Добавить запись</div>
                    <div class="context-menu-divider"></div>
                    <div class="context-menu-item" onclick="showEditForm(currentRecordId)">✏️ Редактировать</div>
                    <div class="context-menu-item delete" onclick="deleteRecordFromMenu()">🗑️ Удалить</div>
                `;
            } else if (userRole === 'editor' && currentTable === 'cam_camera_report') {
                menuHtml = `
                    <div class="context-menu-item" onclick="showAddForm()">➕ Добавить запись</div>
                    <div class="context-menu-divider"></div>
                    <div class="context-menu-item" onclick="showEditForm(currentRecordId)">✏️ Редактировать</div>
                    <div class="context-menu-item delete" onclick="deleteRecordFromMenu()">🗑️ Удалить</div>
                `;
            } else {
                menuHtml = '';
            }
        } else {
            if (userRole === 'admin' || (userRole === 'editor' && currentTable === 'cam_camera_report')) {
                menuHtml = `<div class="context-menu-item" onclick="showAddForm()">➕ Добавить запись</div>`;
            } else {
                menuHtml = '';
            }
        }
    } else if (currentTable === 'cam_camera_report') {
        menuHtml = `<div class="context-menu-item" onclick="exportToExcel()">📎 Экспорт в Excel</div>`;
    }
    if (menuHtml) {
        menu.innerHTML = menuHtml;
        document.body.appendChild(menu);
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);
    }
}

function deleteRecordFromMenu() {
    closeContextMenu();
    if (confirm('Вы уверены, что хотите удалить эту запись?')) {
        deleteRecord(currentRecordId);
    }
}

function closeContextMenu() {
    const menu = document.querySelector('.context-menu');
    if (menu) {
        menu.remove();
    }
}

function acquireLock(tableName, recordId) {
    return fetch(`/api/lock/${tableName}/${recordId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        if (response.status === 423) {
            return response.json().then(data => {
                showMessage(`⚠️ Запись редактируется пользователем ${data.locked_by}`, 'error');
                return false;
            });
        }
        return response.json().then(data => true);
    }).catch(error => {
        console.error('Lock error:', error);
        return false;
    });
}

function releaseLock(tableName, recordId) {
    if (currentLockInterval) {
        clearInterval(currentLockInterval);
        currentLockInterval = null;
    }
    return fetch(`/api/unlock/${tableName}/${recordId}`, {
        method: 'DELETE'
    }).catch(error => console.error('Unlock error:', error));
}

function startLockRenewal(tableName, recordId) {
    if (currentLockInterval) {
        clearInterval(currentLockInterval);
    }
    currentLockInterval = setInterval(() => {
        acquireLock(tableName, recordId);
    }, 2 * 60 * 1000);
}

function showEditForm(id) {
    if (!canEditCurrentTable()) {
        showMessage('У вас нет прав на редактирование', 'error');
        return;
    }
    fetch(`/api/data/${currentTable}/${id}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('modal-title').textContent = 'Редактирование записи';
            let fieldsHtml = '';
            if (currentTable === 'cam_camera_report') {
                const camId = data['id_cam'];
                const currentCondition = data['condition'];
                const currentBreakdown = data['breakdown'];
                fetch('/api/data/cam_camers')
                    .then(response => response.json())
                    .then(camsData => {
                        const cam = camsData.data.find(c => c.id == camId);
                        if (cam) {
                            const regId = cam.idreg;
                            loadRegistratorsCache().then(() => {
                                let conditionOptionsHtml = '';
                                conditionOptions.forEach(opt => {
                                    const selected = (opt === currentCondition) ? 'selected' : '';
                                    conditionOptionsHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
                                });
                                const currentBreakdowns = currentBreakdown ? currentBreakdown.split(',') : [];
                                fieldsHtml = `
                                    <label>Регистратор:</label>
                                    <select id="registrator-select-edit" onchange="updateCamerasByRegistratorForEdit(this.value)" style="width: 100%; padding: 8px; margin: 5px 0;">
                                        <option value="">Выберите регистратор</option>
                                        ${Object.entries(registratorsCache).map(([regIdOption, regName]) => 
                                            `<option value="${regIdOption}" ${regIdOption == regId ? 'selected' : ''}>${regName}</option>`
                                        ).join('')}
                                    </select>
                                    <label>Камера:</label>
                                    <select id="camera-select-edit" name="id_cam" required style="width: 100%; padding: 8px; margin: 5px 0;">
                                        <option value="">Сначала выберите регистратор</option>
                                    </select>
                                    <label>Состояние:</label>
                                    <select id="condition-select-edit" name="condition" required onchange="toggleBreakdownFieldEdit()" style="width: 100%; padding: 8px; margin: 5px 0;">
                                        ${conditionOptionsHtml}
                                    </select>
                                    <div id="breakdown-field-edit" style="display: ${(currentCondition === 'Частично не исправна' || currentCondition === 'Неисправна') ? 'block' : 'none'}; margin: 10px 0;">
                                        <label>Поломка (нажмите для выбора, нажмите еще раз для отмены):</label>
                                        <div id="breakdown-multiselect-edit" style="margin-top: 5px;"></div>
                                    </div>
                                    <label>Примечание:</label>
                                    <textarea name="comment" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;">${data['comment'] || ''}</textarea>
                                `;
                                fieldsHtml += `<input type="hidden" name="id" value="${id}">`;
                                document.getElementById('modal-fields').innerHTML = fieldsHtml;
                                document.getElementById('modal').style.display = 'flex';
                                updateCamerasByRegistratorForEdit(regId, camId);
                                const breakdownDiv = document.getElementById('breakdown-multiselect-edit');
                                if (breakdownDiv) {
                                    breakdownDiv.innerHTML = createBreakdownSelect('breakdown-select-edit', currentBreakdowns);
                                }
                                document.getElementById('edit-form').onsubmit = (e) => {
                                    e.preventDefault();
                                    const condition = document.getElementById('condition-select-edit').value;
                                    const comment = document.querySelector('textarea[name="comment"]').value;
                                    const idCam = document.getElementById('camera-select-edit').value;
                                    const selectedBreakdowns = getSelectedBreakdownsFromDiv('breakdown-select-edit');
                                    updateReportRecord(id, idCam, condition, selectedBreakdowns, comment);
                                };
                            });
                        }
                    });
                return;
            }
            else if (currentTable === 'cam_users') {
                for (let key in data) {
                    if (key === 'id') continue;
                    const displayName = columnNames[key] || key;
                    let inputValue = data[key] || '';
                    if (key === 'password') {
                        if (userRole === 'admin') {
                            fieldsHtml += `
                                <label>${displayName}:</label>
                                <input type="text" name="${key}" value="" placeholder="Введите новый пароль" style="width: 100%; padding: 8px; margin: 5px 0;">
                                <small style="color: #666; display: block; margin-top: -3px; margin-bottom: 10px;">Оставьте пустым, чтобы не менять пароль</small>
                            `;
                        } else {
                            fieldsHtml += `
                                <label>${displayName}:</label>
                                <input type="password" name="${key}" value="●●●●●●" disabled style="width: 100%; padding: 8px; margin: 5px 0; background: #f0f0f0;">
                                <small style="color: #666; display: block; margin-top: -3px; margin-bottom: 10px;">Только администратор может менять пароль</small>
                            `;
                        }
                    } else {
                        fieldsHtml += `
                            <label>${displayName}:</label>
                            <input type="text" name="${key}" value="${inputValue}" style="width: 100%; padding: 8px; margin: 5px 0;">
                        `;
                    }
                }
            }
            else {
                for (let key in data) {
                    if (key === 'id') continue;
                    const displayName = columnNames[key] || key;
                    let inputValue = data[key] || '';
                    if (currentTable === 'cam_registrators' && key === 'ip') {
                        fieldsHtml += `
                            <label>${displayName}:</label>
                            <input type="text" name="${key}" value="${inputValue}" placeholder="например: 192.168.1.100" style="width: 100%; padding: 8px; margin: 5px 0;">
                        `;
                    } else {
                        fieldsHtml += `
                            <label>${displayName}:</label>
                            <input type="text" name="${key}" value="${inputValue}" style="width: 100%; padding: 8px; margin: 5px 0;">
                        `;
                    }
                }
            }
            fieldsHtml += `<input type="hidden" name="id" value="${id}">`;
            document.getElementById('modal-fields').innerHTML = fieldsHtml;
            document.getElementById('modal').style.display = 'flex';
            document.getElementById('edit-form').onsubmit = (e) => {
                e.preventDefault();
                const formData = new FormData(document.getElementById('edit-form'));
                const submitData = {};
                formData.forEach((value, key) => {
                    if (key !== 'id') {
                        submitData[key] = value;
                    }
                });
                if (currentTable === 'cam_users' && submitData.password === '') {
                    delete submitData.password;
                }
                saveRecord(id, submitData);
            };
        });
}

function saveRecord(id, data) {
    fetch(`/api/data/${currentTable}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (response.status === 409) {
            return response.json().then(errorData => {
                showConflictDialog(errorData.message, id);
                throw new Error('Conflict');
            });
        }
        return response.json();
    })
    .then(result => {
        if (result && result.success) {
            releaseLock(currentEditTable, currentEditId);
            closeModal();
            loadTable(currentTable);
            showMessage('Запись успешно обновлена', 'success');
        } else if (result && !result.success) {
            showMessage('Ошибка: ' + result.error, 'error');
        }
    })
    .catch(error => {
        if (error.message !== 'Conflict') {
            console.error('Error:', error);
            showMessage('Ошибка при сохранении', 'error');
        }
    });
}

function showConflictDialog(message, recordId) {
    releaseLock(currentEditTable, currentEditId);
    const conflictHtml = `
        <div id="conflict-modal" class="modal" style="display: flex; z-index: 3000;">
            <div class="modal-content" style="max-width: 450px;">
                <h3 style="color: #e74c3c; margin-bottom: 15px;">⚠️ Конфликт изменений</h3>
                <p style="margin: 15px 0; line-height: 1.5;">${message}</p>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0;">
                    <small>💡 Совет: Скопируйте ваши изменения, затем обновите страницу и попробуйте снова.</small>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button onclick="closeConflictDialog()" class="cancel-btn">Отмена</button>
                    <button onclick="refreshAndReload(${recordId})" class="save-btn">Обновить страницу</button>
                </div>
            </div>
        </div>
    `;
    const existing = document.getElementById('conflict-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', conflictHtml);
    closeModal();
}

function closeConflictDialog() {
    const modal = document.getElementById('conflict-modal');
    if (modal) modal.remove();
}

function refreshAndReload(recordId) {
    closeConflictDialog();
    loadTable(currentTable);
    setTimeout(() => {
        showMessage('✅ Данные обновлены. Вы можете снова открыть запись для редактирования.', 'success');
    }, 500);
}

function closeModal() {
    if (currentEditId && currentEditTable) {
        releaseLock(currentEditTable, currentEditId);
        currentEditId = null;
        currentEditTable = null;
        currentEditVersion = null;
    }
    document.getElementById('modal').style.display = 'none';
}

function updateCamerasByRegistratorForEdit(registratorId, selectedCamId = null) {
    const cameraSelect = document.getElementById('camera-select-edit');
    const registratorSelect = document.getElementById('registrator-select-edit');
    if (registratorSelect) {
        registratorSelect.value = registratorId;
    }
    if (!registratorId) {
        cameraSelect.innerHTML = '<option value="">Сначала выберите регистратор</option>';
        return;
    }
    fetch('/api/data/cam_camers')
        .then(response => response.json())
        .then(data => {
            const filteredCams = data.data.filter(cam => cam.idreg == registratorId);
            let options = '<option value="">Выберите камеру</option>';
            filteredCams.forEach(cam => {
                const location = cam.location || 'без расположения';
                const camName = `CAM${cam.port} (${location})`;
                const selected = (selectedCamId == cam.id) ? 'selected' : '';
                options += `<option value="${cam.id}" ${selected}>${camName}</option>`;
            });
            cameraSelect.innerHTML = options;
        });
}

function updateCamerasByRegistrator() {
    const registratorSelect = document.getElementById('registrator-select');
    const cameraSelect = document.getElementById('camera-select');
    const selectedRegId = registratorSelect.value;
    if (!selectedRegId) {
        cameraSelect.innerHTML = '<option value="">Сначала выберите регистратор</option>';
        return;
    }
    fetch('/api/data/cam_camers')
        .then(response => response.json())
        .then(data => {
            const filteredCams = data.data.filter(cam => cam.idreg == selectedRegId);
            let options = '<option value="">Выберите камеру</option>';
            filteredCams.forEach(cam => {
                const location = cam.location || 'без расположения';
                const camName = `CAM${cam.port} (${location})`;
                options += `<option value="${cam.id}">${camName}</option>`;
            });
            cameraSelect.innerHTML = options;
        });
}

function createBreakdownSelect(id, selectedValues = []) {
    let html = `<div class="breakdown-select" id="${id}" style="border: 1px solid #ddd; border-radius: 4px; max-height: 150px; overflow-y: auto;">`;
    breakdownOptions.forEach(opt => {
        const isSelected = selectedValues.includes(opt);
        html += `
            <div class="breakdown-option ${isSelected ? 'selected' : ''}" 
                 data-value="${opt}"
                 style="padding: 8px; cursor: pointer; border-bottom: 1px solid #eee; ${isSelected ? 'background-color: #e0e0e0; color: #333; font-weight: 500;' : ''}"
                 onclick="toggleBreakdownOption(this)">
                ${opt}
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

function toggleBreakdownOption(element) {
    const isSelected = element.classList.contains('selected');
    if (isSelected) {
        element.classList.remove('selected');
        element.style.backgroundColor = '';
        element.style.color = '';
        element.style.fontWeight = '';
    } else {
        element.classList.add('selected');
        element.style.backgroundColor = '#e0e0e0';
        element.style.color = '#333';
        element.style.fontWeight = '500';
    }
}

function getSelectedBreakdownsFromDiv(divId) {
    const container = document.getElementById(divId);
    if (!container) return [];
    const selected = [];
    const options = container.querySelectorAll('.breakdown-option.selected');
    options.forEach(opt => {
        selected.push(opt.getAttribute('data-value'));
    });
    return selected;
}

function clearBreakdownSelection(divId) {
    const container = document.getElementById(divId);
    if (!container) return;
    const options = container.querySelectorAll('.breakdown-option');
    options.forEach(opt => {
        opt.classList.remove('selected');
        opt.style.backgroundColor = '';
        opt.style.color = '';
        opt.style.fontWeight = '';
    });
}

function toggleBreakdownField() {
    const conditionSelect = document.getElementById('condition-select');
    const breakdownDiv = document.getElementById('breakdown-field');
    if (conditionSelect) {
        const selectedCondition = conditionSelect.value;
        if (selectedCondition === 'Частично не исправна' || selectedCondition === 'Неисправна') {
            breakdownDiv.style.display = 'block';
        } else {
            breakdownDiv.style.display = 'none';
            clearBreakdownSelection('breakdown-select-add');
        }
    }
}

function toggleBreakdownFieldEdit() {
    const conditionSelect = document.getElementById('condition-select-edit');
    const breakdownDiv = document.getElementById('breakdown-field-edit');
    if (conditionSelect) {
        const selectedCondition = conditionSelect.value;
        if (selectedCondition === 'Частично не исправна' || selectedCondition === 'Неисправна') {
            breakdownDiv.style.display = 'block';
        } else {
            breakdownDiv.style.display = 'none';
            clearBreakdownSelection('breakdown-select-edit');
        }
    }
}

function buildAddFormFields() {
    fetch(`/api/structure/${currentTable}`)
        .then(response => response.json())
        .then(data => {
            let fieldsHtml = '';
            if (currentTable === 'cam_camera_report') {
                let conditionOptionsHtml = '';
                conditionOptions.forEach(opt => {
                    conditionOptionsHtml += `<option value="${opt}">${opt}</option>`;
                });
                fieldsHtml = `
                    <label>Регистратор:</label>
                    <select id="registrator-select" onchange="updateCamerasByRegistratorWithFilter()" style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="">Выберите регистратор</option>
                        ${Object.entries(registratorsCache).map(([regId, regName]) => 
                            `<option value="${regId}">${regName}</option>`
                        ).join('')}
                    </select>
                    <label>Камера:</label>
                    <select id="camera-select" name="id_cam" required style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="">Сначала выберите регистратор</option>
                    </select>
                    <div id="last-report-info" style="display: none; margin: 10px 0;"></div>
                    <label>Состояние:</label>
                    <select id="condition-select" name="condition" required onchange="toggleBreakdownField()" style="width: 100%; padding: 8px; margin: 5px 0;">
                        ${conditionOptionsHtml}
                    </select>
                    <div id="breakdown-field" style="display: none; margin: 10px 0;">
                        <label>Поломка (нажмите для выбора, нажмите еще раз для отмены):</label>
                        <div id="breakdown-multiselect" style="margin-top: 5px;"></div>
                    </div>
                    <label>Примечание:</label>
                    <textarea name="comment" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;"></textarea>
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="hide-today-cameras" onchange="updateCamerasByRegistratorWithFilter()">
                                <span class="checkbox-text">🚫 Не показывать камеры, уже добавленные сегодня</span>
                            </label>
                        </div>
                        <div class="checkbox-group" style="margin-top: 8px;">
                            <label class="checkbox-label">
                                <input type="checkbox" id="show-last-report" onchange="showLastReportInfo()">
                                <span class="checkbox-text">📋 Показать последнюю запись по камере</span>
                            </label>
                        </div>
                    </div>
                `;
                document.getElementById('modal-fields').innerHTML = fieldsHtml;
                const breakdownDiv = document.getElementById('breakdown-multiselect');
                if (breakdownDiv) {
                    breakdownDiv.innerHTML = createBreakdownSelect('breakdown-select-add', []);
                }
                document.getElementById('modal').style.display = 'flex';
                document.getElementById('edit-form').onsubmit = (e) => {
                    e.preventDefault();
                    addReportRecord();
                };
                return;
            }
            data.columns.forEach(col => {
                const cleanCol = col.replace(' (NOT NULL)', '');
                if (cleanCol === 'id') {
                    return;
                }
                const displayName = columnNames[cleanCol] || cleanCol;
                const isRequired = col.includes('NOT NULL');
                fieldsHtml += `
                    <label>${displayName}${isRequired ? ' *' : ''}:</label>
                    <input type="text" name="${cleanCol}" ${isRequired ? 'required' : ''} style="width: 100%; padding: 8px; margin: 5px 0;">
                `;
            });
            document.getElementById('modal-fields').innerHTML = fieldsHtml;
            document.getElementById('modal').style.display = 'flex';
            document.getElementById('edit-form').onsubmit = (e) => {
                e.preventDefault();
                addRecord();
            };
        });
}

function buildAddFormFieldsForRegistrators() {
    fetch(`/api/structure/${currentTable}`)
        .then(response => response.json())
        .then(data => {
            let fieldsHtml = '';
            fieldsHtml += `
                <label>АП (номер предприятия) *:</label>
                <input type="number" name="ap" required style="width: 100%; padding: 8px; margin: 5px 0;">
                <label>Номер регистратора на АП *:</label>
                <input type="number" name="id_reg_on_ap" required style="width: 100%; padding: 8px; margin: 5px 0;">
            `;
            data.columns.forEach(col => {
                const cleanCol = col.replace(' (NOT NULL)', '');
                if (cleanCol === 'id' || cleanCol === 'ap' || cleanCol === 'id_reg_on_ap') {
                    return;
                }
                const displayName = columnNames[cleanCol] || cleanCol;
                const isRequired = col.includes('NOT NULL');
                fieldsHtml += `
                    <label>${displayName}${isRequired ? ' *' : ''}:</label>
                    <input type="text" name="${cleanCol}" ${isRequired ? 'required' : ''} style="width: 100%; padding: 8px; margin: 5px 0;">
                `;
            });
            document.getElementById('modal-fields').innerHTML = fieldsHtml;
            document.getElementById('modal').style.display = 'flex';
            document.getElementById('edit-form').onsubmit = (e) => {
                e.preventDefault();
                addRecord();
            };
        });
}

function showAddForm() {
    if (!canEditCurrentTable()) {
        showMessage('У вас нет прав на добавление записей', 'error');
        return;
    }
    document.getElementById('modal-title').textContent = 'Добавление записи';
    if (currentTable === 'cam_camera_report') {
        Promise.all([loadRegistratorsCache(), loadCamerasCache()]).then(() => {
            buildAddFormFields();
        });
    } else if (currentTable === 'cam_registrators') {
        buildAddFormFieldsForRegistrators();
    } else {
        buildAddFormFields();
    }
}

function addReportRecord() {
    const idCam = document.getElementById('camera-select').value;
    const condition = document.getElementById('condition-select').value;
    const comment = document.querySelector('textarea[name="comment"]').value;
    const selectedBreakdowns = getSelectedBreakdownsFromDiv('breakdown-select-add');
    if (!idCam || !condition) {
        showMessage('Пожалуйста, заполните все обязательные поля', 'error');
        return;
    }
    const promises = [];
    const currentDate = new Date().toISOString().split('T')[0];
    if (selectedBreakdowns.length === 0) {
        const data = {
            id_cam: idCam,
            condition: condition,
            breakdown: '',
            comment: comment,
            recording_date: currentDate
        };
        promises.push(
            fetch(`/api/data/${currentTable}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
        );
    } else {
        selectedBreakdowns.forEach(breakdown => {
            const data = {
                id_cam: idCam,
                condition: condition,
                breakdown: breakdown,
                comment: comment,
                recording_date: currentDate
            };
            promises.push(
                fetch(`/api/data/${currentTable}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
            );
        });
    }
    Promise.all(promises)
        .then(responses => {
            let allSuccess = true;
            for (let response of responses) {
                if (!response.ok) {
                    allSuccess = false;
                    break;
                }
            }
            if (allSuccess) {
                closeModal();
                loadTable(currentTable);
                showMessage('Запись успешно добавлена', 'success');
            } else {
                showMessage('Ошибка при добавлении', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showMessage('Ошибка при добавлении', 'error');
        });
}

function updateReportRecord(id, idCam, condition, breakdowns, comment) {
    fetch(`/api/data/cam_camera_report/${id}`, {
        method: 'DELETE'
    }).then(() => {
        const promises = [];
        const currentDate = new Date().toISOString().split('T')[0];
        if (breakdowns.length === 0) {
            const data = {
                id_cam: idCam,
                condition: condition,
                breakdown: '',
                comment: comment,
                recording_date: currentDate
            };
            promises.push(
                fetch(`/api/data/cam_camera_report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
            );
        } else {
            breakdowns.forEach(breakdown => {
                const data = {
                    id_cam: idCam,
                    condition: condition,
                    breakdown: breakdown,
                    comment: comment,
                    recording_date: currentDate
                };
                promises.push(
                    fetch(`/api/data/cam_camera_report`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    })
                );
            });
        }
        Promise.all(promises)
            .then(() => {
                closeModal();
                loadTable(currentTable);
                showMessage('Запись успешно обновлена', 'success');
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('Ошибка при обновлении', 'error');
            });
    });
}

function addRecord() {
    const form = document.getElementById('edit-form');
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });
    delete data.id;
    fetch(`/api/data/${currentTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            closeModal();
            loadTable(currentTable);
            showMessage('Запись успешно добавлена', 'success');
        } else {
            showMessage('Ошибка: ' + result.error, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('Ошибка при добавлении', 'error');
    });
}

function deleteRecord(id) {
    if (userRole !== 'admin' && !(userRole === 'editor' && currentTable === 'cam_camera_report')) {
        showMessage('У вас нет прав на удаление', 'error');
        return;
    }
    fetch(`/api/data/${currentTable}/${id}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            loadTable(currentTable);
            showMessage('Запись успешно удалена', 'success');
        } else {
            showMessage('Ошибка: ' + result.error, 'error');
        }
    });
}

function getButtonText(tableName) {
    const names = {
        'cam_registrators': 'Регистраторы',
        'cam_camers': 'Камеры',
        'cam_camera_report': 'Отчеты',
        'cam_users': 'Пользователи',
        'cam_action_log': 'Журнал действий'
    };
    return names[tableName] || tableName;
}

function exportToExcel() {
    if (Object.keys(camerasCache).length === 0 || Object.keys(registratorsCache).length === 0) {
        showMessage('Загрузка данных, повторите попытку через секунду', 'error');
        Promise.all([loadCamerasCache(), loadRegistratorsCache()]).then(() => {
            exportToExcel();
        });
        return;
    }
    let workingData = [...originalData];
    workingData = applyReportDataFilters(workingData);
    let filteredData = applyFilters(workingData);
    let sortedData = applySorting(filteredData);
    if (sortedData.length === 0) {
        showMessage('Нет данных для экспорта', 'error');
        return;
    }
    const exportData = [];
    for (const report of sortedData) {
        const cam = camerasCache[report.id_cam];
        if (!cam) continue;
        const regFullName = registratorsCache[cam.idreg];
        let apNumber = '';
        let regNumber = '';
        if (regFullName) {
            const match = regFullName.match(/АП(\d+)_(\d+)/);
            if (match) {
                apNumber = match[1];
                regNumber = match[2];
            }
        }
        let formattedDate = '';
        if (report.recording_date) {
            const d = new Date(report.recording_date);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                formattedDate = `${day}.${month}.${year}`;
            } else {
                formattedDate = report.recording_date;
            }
        }
        const exportRow = {
            'АП': apNumber,
            'Регистратор': regNumber,
            'Камера': cam.port || '',
            'Тип': cam.type || '',
            'Расположение': cam.location || '',
            'Расширение': cam.expansion || '',
            'Состояние': report.condition || '',
            'Тип поломки': report.breakdown || '',
            'Дата записи': formattedDate
        };
        exportData.push(exportRow);
    }
    fetch('/export_excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `camera_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showMessage(`✅ Экспортировано ${exportData.length} записей`, 'success');
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при экспорте', 'error');
    });
}

function exportActionLogToExcel() {
    let workingData = [...originalData];
    if (actionLogFilters.startDate) {
        const start = new Date(actionLogFilters.startDate);
        workingData = workingData.filter(row => {
            const [day, month, year] = row.action_date.split('.');
            const rowDate = new Date(`${year}-${month}-${day}`);
            return rowDate >= start;
        });
    }
    if (actionLogFilters.endDate) {
        const end = new Date(actionLogFilters.endDate);
        workingData = workingData.filter(row => {
            const [day, month, year] = row.action_date.split('.');
            const rowDate = new Date(`${year}-${month}-${day}`);
            return rowDate <= end;
        });
    }
    if (actionLogFilters.userFilter) {
        workingData = workingData.filter(row => row.user === actionLogFilters.userFilter);
    }
    if (actionLogFilters.actionFilter) {
        workingData = workingData.filter(row => row.action === actionLogFilters.actionFilter);
    }
    if (actionLogFilters.tableFilter) {
        workingData = workingData.filter(row => row.table_name === actionLogFilters.tableFilter);
    }
    if (workingData.length === 0) {
        showMessage('Нет данных для экспорта', 'error');
        return;
    }
    const exportData = workingData.map(row => ({
        'Дата': row.action_date || '',
        'Время': row.action_time || '',
        'Пользователь': row.user || '',
        'Действие': row.action || '',
        'Таблица': row.table_name || '',
        'ID записи': row.record_id || '',
        'Поле': row.field_name || '',
        'Было': row.old_value || '',
        'Стало': row.new_value || ''
    }));
    fetch('/export_action_log_excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `action_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showMessage(`✅ Экспортировано ${exportData.length} записей`, 'success');
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при экспорте', 'error');
    });
}

function addExportButtonForActionLog() {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    const oldExportBtn = document.getElementById('export-excel-below');
    if (oldExportBtn) oldExportBtn.remove();
    const exportContainer = document.createElement('div');
    exportContainer.id = 'export-excel-below';
    exportContainer.style.cssText = 'text-align: right; margin-top: 15px; padding: 10px;';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📎 Экспорт в Excel';
    exportBtn.className = 'filter-btn';
    exportBtn.style.cssText = 'background: #27ae60; color: white; border-color: #27ae60; padding: 8px 20px; font-size: 14px; cursor: pointer;';
    exportBtn.onclick = () => exportActionLogToExcel();
    exportContainer.appendChild(exportBtn);
    tableContainer.parentNode.insertBefore(exportContainer, tableContainer.nextSibling);
}

function buildActionLogFiltersUI() {
    const container = document.getElementById('filter-buttons-container');
    if (!container) return;
    const today = getTodayDate();
    if (!actionLogFilters.startDate) actionLogFilters.startDate = today;
    if (!actionLogFilters.endDate) actionLogFilters.endDate = today;
    let users = [...new Set(originalData.map(row => row.user).filter(v => v))];
    let actions = [...new Set(originalData.map(row => row.action).filter(v => v))];
    let tables = [...new Set(originalData.map(row => row.table_name).filter(v => v))];
    let html = `
        <div class="report-filters-minimal">
            <div class="filter-row">
                <div class="filter-item">
                    <span class="filter-label">📅 Период</span>
                    <input type="date" id="action-start-date" class="date-input-mini" value="${actionLogFilters.startDate}" max="${today}" onchange="updateActionLogDateFilter()">
                    <span>—</span>
                    <input type="date" id="action-end-date" class="date-input-mini" value="${actionLogFilters.endDate}" max="${today}" onchange="updateActionLogDateFilter()">
                </div>
                <div class="filter-item">
                    <span class="filter-label">👤 Пользователь</span>
                    <select id="action-user-filter" class="filter-select-mini" onchange="updateActionLogFilters()">
                        <option value="">Все</option>
                        ${users.map(u => `<option value="${u}" ${actionLogFilters.userFilter === u ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-item">
                    <span class="filter-label">⚡ Действие</span>
                    <select id="action-action-filter" class="filter-select-mini" onchange="updateActionLogFilters()">
                        <option value="">Все</option>
                        ${actions.map(a => `<option value="${a}" ${actionLogFilters.actionFilter === a ? 'selected' : ''}>${a}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-item">
                    <span class="filter-label">📋 Таблица</span>
                    <select id="action-table-filter" class="filter-select-mini" onchange="updateActionLogFilters()">
                        <option value="">Все</option>
                        ${tables.map(t => `<option value="${t}" ${actionLogFilters.tableFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                <!-- Кнопка сброса убрана, так как есть общая кнопка -->
            </div>
        </div>
    `;
    container.innerHTML = html;
}

function updateActionLogDateFilter() {
    const startDate = document.getElementById('action-start-date').value;
    const endDate = document.getElementById('action-end-date').value;
    actionLogFilters.startDate = startDate;
    actionLogFilters.endDate = endDate;
    displayTable();
    saveState();
}

function updateActionLogFilters() {
    const userFilter = document.getElementById('action-user-filter').value;
    const actionFilter = document.getElementById('action-action-filter').value;
    const tableFilter = document.getElementById('action-table-filter').value;
    actionLogFilters.userFilter = userFilter;
    actionLogFilters.actionFilter = actionFilter;
    actionLogFilters.tableFilter = tableFilter;
    displayTable();
    saveState();
}

function resetActionLogFilters() {
    const today = getTodayDate();
    actionLogFilters = {
        startDate: today,
        endDate: today,
        userFilter: '',
        actionFilter: '',
        tableFilter: ''
    };
    const startDateInput = document.getElementById('action-start-date');
    const endDateInput = document.getElementById('action-end-date');
    const userSelect = document.getElementById('action-user-filter');
    const actionSelect = document.getElementById('action-action-filter');
    const tableSelect = document.getElementById('action-table-filter');
    if (startDateInput) startDateInput.value = today;
    if (endDateInput) endDateInput.value = today;
    if (userSelect) userSelect.value = '';
    if (actionSelect) actionSelect.value = '';
    if (tableSelect) tableSelect.value = '';
    displayTable();
    saveState();
}

function loadActionLogFiltersState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.ACTION_LOG_FILTERS);
        if (saved) {
            const parsed = JSON.parse(saved);
            actionLogFilters = { ...actionLogFilters, ...parsed };
        }
    } catch(e) {}
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden && currentTable) {
        loadTable(currentTable);
        showMessage('🔄 Данные обновлены', 'success');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    initUserRole();
    loadState();
    const available = roleTableAccess[userRole] || [];
    if (!available.includes(currentTable) && available.length > 0) {
        currentTable = available[0];
    } else if (!available.includes(currentTable) && userRole === 'user') {
        currentTable = 'cam_camera_report';
    }
    if (userRole === 'user') {
        loadTable('cam_camera_report');
    } else {
        loadTable(currentTable);
    }
    window.addEventListener('beforeunload', function() {
        saveState();
    });
});