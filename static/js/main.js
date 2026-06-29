/**
 * main.js - Точка входа приложения
 */

document.addEventListener('DOMContentLoaded', function() {
    window.CCTV.UI.initUserRole();
    window.CCTV.AppState.loadState();
    
    const availableTables = window.CCTV.Constants.ROLE_TABLE_ACCESS[window.CCTV.AppState.userRole] || [];
    if (!availableTables.includes(window.CCTV.AppState.currentTable)) {
        if (availableTables.includes('cam_camera_report')) {
            window.CCTV.AppState.currentTable = 'cam_camera_report';
        } else if (availableTables.length > 0) {
            window.CCTV.AppState.currentTable = availableTables[0];
        }
    }
    
    loadTable(window.CCTV.AppState.currentTable);
    
    window.addEventListener('beforeunload', function() {
        window.CCTV.AppState.saveState();
    });
});

document.addEventListener('visibilitychange', function() {
    if (!document.hidden && window.CCTV.AppState.currentTable) {
        loadTable(window.CCTV.AppState.currentTable);
        window.CCTV.UI.showMessage('Данные обновлены', 'success');
    }
});

window.loadTable = async function(tableName) {
    if (!window.CCTV.UI.canViewTable(tableName)) {
        window.CCTV.UI.showMessage('У вас нет доступа к этой таблице', 'error');
        return;
    }
    
    window.CCTV.AppState.currentTable = tableName;
    window.CCTV.AppState.currentFilters = {};
    window.CCTV.AppState.currentSort = { column: null, order: null };
    
    updateActiveButton(tableName);
    
    if (window.CCTV.AnalyticsView) window.CCTV.AnalyticsView.hide();
    document.querySelector('.table-container').style.display = 'block';
    const filterContainer = document.getElementById('filter-buttons-container');
    if (filterContainer) filterContainer.style.display = 'flex';
    
    const tableInstance = getTableInstance(tableName);
    if (!tableInstance) {
        console.error('Table instance not found:', tableName);
        return;
    }
    
    await tableInstance.loadData();
    
    if (typeof tableInstance.buildFiltersUI === 'function') {
        tableInstance.buildFiltersUI();
    } else {
        const container = document.getElementById('filter-buttons-container');
        if (container) container.style.display = 'none';
    }
    
    tableInstance.render();
    setupContextMenu(tableInstance);
    window.CCTV.AppState.saveState();
};

function getTableInstance(tableName) {
    const instances = {
        'cam_camera_report': window.CCTV.CameraReportTable,
        'cam_registrators': window.CCTV.RegistratorsTable,
        'cam_camers': window.CCTV.CamerasTable,
        'cam_users': window.CCTV.UsersTable,
        'cam_action_log': window.CCTV.ActionLogTable
    };
    return instances[tableName];
}

function updateActiveButton(tableName) {
    const buttons = document.querySelectorAll('#table-selector button:not(#analytics-btn)');
    const buttonText = window.CCTV.UI.getButtonText(tableName);
    buttons.forEach(btn => {
        if (btn.textContent === buttonText || btn.textContent.includes(buttonText)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    const analyticsBtn = document.getElementById('analytics-btn');
    if (analyticsBtn) analyticsBtn.classList.remove('active');
}

function setupContextMenu(tableInstance) {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    
    const oldRows = document.querySelectorAll('#data-table tbody tr');
    oldRows.forEach(row => {
        row.removeEventListener('contextmenu', row._contextMenuHandler);
        if (row._dblClickHandler) {
            row.removeEventListener('dblclick', row._dblClickHandler);
        }
    });
    
    const canEdit = window.CCTV.UI.canEditCurrentTable();
    
    const rows = document.querySelectorAll('#data-table tbody tr');
    rows.forEach(row => {
        const recordId = row.getAttribute('data-id');
        
        const contextMenuHandler = (e) => {
            e.preventDefault();
            window.CCTV.AppState.currentRecordId = recordId;
            showContextMenu(e.clientX, e.clientY, tableInstance, recordId);
        };
        row.addEventListener('contextmenu', contextMenuHandler);
        row._contextMenuHandler = contextMenuHandler;
    });
    
    tableContainer.removeEventListener('contextmenu', tableContainer._emptyContextHandler);
    const emptyContextHandler = (e) => {
        if (!e.target.closest('tr')) {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, tableInstance, null);
        }
    };
    tableContainer.addEventListener('contextmenu', emptyContextHandler);
    tableContainer._emptyContextHandler = emptyContextHandler;
}

function showContextMenu(x, y, tableInstance, recordId) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();
    
    const canEdit = window.CCTV.UI.canEditCurrentTable();
    const currentTable = window.CCTV.AppState.currentTable;
    
    let menuHtml = '';
    
    if (currentTable === 'cam_camera_report') {
        menuHtml += `<div class="context-menu-item" onclick="window.CCTV.CameraReportTable.exportToExcel()">Экспорт в Excel</div>`;
    } else if (currentTable === 'cam_action_log') {
        menuHtml += `<div class="context-menu-item" onclick="window.CCTV.ActionLogTable.exportToExcel()">Экспорт в Excel</div>`;
    }
    
    if (menuHtml && canEdit) {
        menuHtml += `<div class="context-menu-divider"></div>`;
    }
    
    if (canEdit) {
        if (recordId) {
            menuHtml += `
                <div class="context-menu-item" onclick="showAddForm()">Добавить запись</div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item" onclick="showEditForm(${recordId})">Редактировать</div>
                <div class="context-menu-item delete" onclick="deleteRecordFromMenu(${recordId})">Удалить</div>
            `;
        } else {
            menuHtml += `<div class="context-menu-item" onclick="showAddForm()">Добавить запись</div>`;
        }
    }
    
    if (!menuHtml) return;
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;
    
    let left = x;
    let top = y;
    
    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
    }
    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10;
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

window.showAddForm = function() {
    const tableInstance = getTableInstance(window.CCTV.AppState.currentTable);
    if (tableInstance && typeof tableInstance.showAddForm === 'function') {
        tableInstance.showAddForm();
    } else {
        window.CCTV.UI.showMessage('Форма добавления не доступна', 'error');
    }
};

window.showEditForm = function(id) {
    const tableInstance = getTableInstance(window.CCTV.AppState.currentTable);
    if (tableInstance && typeof tableInstance.showEditForm === 'function') {
        tableInstance.showEditForm(id);
    } else {
        window.CCTV.UI.showMessage('Форма редактирования не доступна', 'error');
    }
};

window.deleteRecordFromMenu = function(id) {
    if (confirm('Вы уверены, что хотите удалить эту запись?')) {
        const tableInstance = getTableInstance(window.CCTV.AppState.currentTable);
        if (tableInstance && typeof tableInstance.deleteRecord === 'function') {
            tableInstance.deleteRecord(id);
        }
    }
    closeContextMenu();
};

window.closeContextMenu = function() {
    const menu = document.querySelector('.context-menu');
    if (menu) menu.remove();
};

window.showColumnMenu = function(event, column) {
    const tableInstance = getTableInstance(window.CCTV.AppState.currentTable);
    if (tableInstance && typeof tableInstance.showColumnMenu === 'function') {
        tableInstance.showColumnMenu(event, column);
    }
};

window.setFilter = function(column, value) {
    const tableInstance = getTableInstance(window.CCTV.AppState.currentTable);
    if (tableInstance && typeof tableInstance.setFilter === 'function') {
        tableInstance.setFilter(column, value);
    }
};

// ИЗМЕНЁННАЯ функция сброса фильтров
window.resetAllFilters = function() {
    const currentTable = window.CCTV.AppState.currentTable;
    
    switch (currentTable) {
        case 'cam_camera_report':
            const today = window.CCTV.UI.getTodayDate();
            window.CCTV.AppState.reportFilters = {
                startDate: today,
                endDate: today,
                apFilters: new Set(),
                registratorFilters: new Set(),
                conditionFilters: new Set()
            };
            // ДОБАВЛЕНО: сбрасываем специальный режим
            if (window.CCTV.CameraReportTable) {
                window.CCTV.CameraReportTable.showLatestOnly = false;
            }
            if (window.CCTV.CameraReportTable && typeof window.CCTV.CameraReportTable.buildFiltersUI === 'function') {
                window.CCTV.CameraReportTable.reportFilters = window.CCTV.AppState.reportFilters;
                window.CCTV.CameraReportTable.buildFiltersUI();
                window.CCTV.loadTable('cam_camera_report');
            }
            break;
        case 'cam_registrators':
            window.CCTV.AppState.currentApFilter = null;
            if (window.CCTV.RegistratorsTable) {
                window.CCTV.RegistratorsTable.currentApFilter = null;
                window.CCTV.RegistratorsTable.buildFiltersUI();
                window.CCTV.loadTable('cam_registrators');
            }
            break;
        case 'cam_camers':
            window.CCTV.AppState.currentRegistratorFilters.clear();
            if (window.CCTV.CamerasTable) {
                window.CCTV.CamerasTable.currentRegistratorFilters.clear();
                window.CCTV.CamerasTable.buildFiltersUI();
                window.CCTV.loadTable('cam_camers');
            }
            break;
        case 'cam_action_log':
            const todayLog = window.CCTV.UI.getTodayDate();
            window.CCTV.AppState.actionLogFilters = {
                startDate: todayLog,
                endDate: todayLog,
                userFilter: '',
                actionFilter: '',
                tableFilter: ''
            };
            if (window.CCTV.ActionLogTable) {
                window.CCTV.ActionLogTable.actionLogFilters = window.CCTV.AppState.actionLogFilters;
                window.CCTV.ActionLogTable.buildFiltersUI();
                window.CCTV.loadTable('cam_action_log');
            }
            break;
        case 'cam_users':
            break;
    }
    
    window.CCTV.AppState.currentFilters = {};
    window.CCTV.AppState.currentSort = { column: null, order: null };
    
    if (window.CCTV.CameraReportTable && currentTable === 'cam_camera_report') {
        window.CCTV.CameraReportTable.currentFilters = {};
        window.CCTV.CameraReportTable.currentSort = { column: null, order: null };
    }
    if (window.CCTV.RegistratorsTable && currentTable === 'cam_registrators') {
        window.CCTV.RegistratorsTable.currentFilters = {};
        window.CCTV.RegistratorsTable.currentSort = { column: null, order: null };
    }
    if (window.CCTV.CamerasTable && currentTable === 'cam_camers') {
        window.CCTV.CamerasTable.currentFilters = {};
        window.CCTV.CamerasTable.currentSort = { column: null, order: null };
    }
    if (window.CCTV.UsersTable && currentTable === 'cam_users') {
        window.CCTV.UsersTable.currentFilters = {};
        window.CCTV.UsersTable.currentSort = { column: null, order: null };
    }
    if (window.CCTV.ActionLogTable && currentTable === 'cam_action_log') {
        window.CCTV.ActionLogTable.currentFilters = {};
        window.CCTV.ActionLogTable.currentSort = { column: null, order: null };
    }
    
    window.loadTable(currentTable);
    window.CCTV.AppState.saveState();
    window.CCTV.UI.showMessage('Фильтры таблицы "' + window.CCTV.UI.getButtonText(currentTable) + '" сброшены', 'success');
};

function buildTableButtons() {
    const container = document.getElementById('table-selector');
    if (!container) return;
    
    const availableTables = window.CCTV.Constants.ROLE_TABLE_ACCESS[window.CCTV.AppState.userRole] || [];
    const tableNames = {
        'cam_registrators': 'Регистраторы',
        'cam_camers': 'Камеры',
        'cam_camera_report': 'Отчеты',
        'cam_users': 'Пользователи',
        'cam_action_log': 'Журнал действий'
    };
    
    let buttonsHtml = '';
    availableTables.forEach(table => {
        buttonsHtml += `<button onclick="window.loadTable('${table}')">${tableNames[table]}</button>`;
    });
    buttonsHtml += `<button id="analytics-btn" style="background: #3498db;">Аналитика</button>`;
    container.innerHTML = buttonsHtml;
    
    const analyticsBtn = document.getElementById('analytics-btn');
    if (analyticsBtn) {
        analyticsBtn.addEventListener('click', () => {
            document.querySelectorAll('#table-selector button').forEach(btn => btn.classList.remove('active'));
            analyticsBtn.classList.add('active');
            document.querySelector('.table-container').style.display = 'none';
            const filterContainer = document.getElementById('filter-buttons-container');
            if (filterContainer) filterContainer.style.display = 'none';
            window.CCTV.AnalyticsView.show();
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    buildTableButtons();
});

window.CCTV = window.CCTV || {};
window.CCTV.loadTable = window.loadTable;
window.CCTV.showAddForm = window.showAddForm;
window.CCTV.showEditForm = window.showEditForm;
window.CCTV.deleteRecordFromMenu = window.deleteRecordFromMenu;
window.CCTV.showColumnMenu = window.showColumnMenu;
window.CCTV.setFilter = window.setFilter;
window.CCTV.resetAllFilters = window.resetAllFilters;
window.CCTV.closeModal = window.CCTV.UI.closeModal;