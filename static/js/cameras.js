/**
 * cameras.js - Таблица камер
 */

class CamerasTable extends window.CCTV.BaseTable {
    constructor() {
        super('cam_camers');
        this.currentRegistratorFilters = window.CCTV.AppState.currentRegistratorFilters;
    }
    
    async loadData() {
        await window.CCTV.API.loadRegistratorsCache();
        const response = await fetch(`/api/data/${this.tableName}`);
        const data = await response.json();
        this.originalData = data.data;
        return this.originalData;
    }
    
    applyRegistratorFilter(data) {
        if (this.currentRegistratorFilters.size === 0) return data;
        return data.filter(cam => this.currentRegistratorFilters.has(cam.idreg));
    }
    
    render() {
        let workingData = [...this.originalData];
        workingData = this.applyRegistratorFilter(workingData);
        let filteredData = this.applyFilters(workingData);
        let sortedData = this.applySorting(filteredData);
        
        if (sortedData.length === 0) {
            document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center;">Нет данных</p>';
            return;
        }
        
        const columnsToDisplay = window.CCTV.Constants.COLUMN_ORDER['cam_camers'];
        
        let html = `<div style="padding: 10px 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 8px 8px 0 0; font-size: 13px; color: #555;">
            📊 Найдено записей: ${sortedData.length}
        </div>`;
        
        html += '<table id="data-table"><thead></tr>';
        columnsToDisplay.forEach(col => {
            const displayName = window.CCTV.Constants.COLUMN_NAMES[col] || col;
            const noFilterCols = ['idreg', 'port', 'location'];
            const canFilter = !noFilterCols.includes(col) && !window.CCTV.Constants.NO_FILTER_COLUMNS[this.tableName]?.includes(col);
            
            if (canFilter) {
                html += `<th style="position: relative;">
                    <button class="column-btn" onclick="window.CCTV.showColumnMenu(event, '${col}')" style="cursor: pointer;">
                        ${window.CCTV.UI.escapeHtml(displayName)}
                    </button>
                </th>`;
            } else {
                html += `<th style="position: relative;">
                    <div class="column-btn" style="cursor: default; opacity: 0.7;">
                        ${window.CCTV.UI.escapeHtml(displayName)}
                    </div>
                </th>`;
            }
        });
        html += '</tr></thead><tbody>';
        
        for (const row of sortedData) {
            html += '<tr data-id="' + row.id + '">';
            for (const col of columnsToDisplay) {
                let value = row[col];
                if (value === null) value = '';
                
                if (col === 'idreg' && value) {
                    const regInfo = window.CCTV.AppState.registratorsCache[value];
                    const displayReg = regInfo || `Регистратор #${value}`;
                    html += `<td>${window.CCTV.UI.escapeHtml(displayReg)}</td>`;
                } else {
                    html += `<td>${window.CCTV.UI.escapeHtml(value)}</td>`;
                }
            }
            html += '</tr>';
        }
        
        html += '</tbody></table>';
        
        document.getElementById('table-content').innerHTML = html;
    }
    
    buildFiltersUI() {
        const container = document.getElementById('filter-buttons-container');
        if (!container) return;
        
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
        
        const registratorsList = Object.entries(window.CCTV.AppState.registratorsCache).map(([id, name]) => ({
            id: parseInt(id),
            name: name
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        const totalRegistrators = registratorsList.length;
        const selectedCount = this.currentRegistratorFilters.size;
        const allSelected = (selectedCount === totalRegistrators && totalRegistrators > 0);
        const noneSelected = (selectedCount === 0);
        const isAllActive = noneSelected || allSelected;
        
        let buttonsHtml = '<span class="filter-buttons-title">Фильтр по регистраторам:</span>';
        buttonsHtml += `<button class="filter-btn ${isAllActive ? 'all-active' : ''}" onclick="window.CCTV.CamerasTable.toggleRegistratorFilter(null)">Все регистраторы</button>`;
        
        registratorsList.forEach(reg => {
            const isActive = this.currentRegistratorFilters.has(reg.id);
            const showActive = isActive && !allSelected;
            buttonsHtml += `<button class="filter-btn ${showActive ? 'active' : ''}" onclick="window.CCTV.CamerasTable.toggleRegistratorFilter(${reg.id})">${window.CCTV.UI.escapeHtml(reg.name)}</button>`;
        });
        
        buttonsHtml += `<button class="reset-filters-icon" onclick="window.resetAllFilters()" title="Сбросить все фильтры">↻</button>`;
        
        container.innerHTML = buttonsHtml;
        container.style.display = 'flex';
    }
    
    toggleRegistratorFilter(registratorId) {
        const registratorsList = Object.keys(window.CCTV.AppState.registratorsCache).map(id => parseInt(id));
        const totalRegistrators = registratorsList.length;
        
        if (registratorId === null) {
            this.currentRegistratorFilters.clear();
        } else {
            if (this.currentRegistratorFilters.has(registratorId)) {
                this.currentRegistratorFilters.delete(registratorId);
            } else {
                this.currentRegistratorFilters.add(registratorId);
            }
            
            const allSelected = (this.currentRegistratorFilters.size === totalRegistrators);
            if (allSelected) {
                this.currentRegistratorFilters.clear();
            }
        }
        
        window.CCTV.AppState.currentRegistratorFilters = this.currentRegistratorFilters;
        window.CCTV.loadTable(this.tableName);
        window.CCTV.AppState.saveState();
    }
    
    showAddForm() {
        if (!window.CCTV.UI.canEditCurrentTable()) {
            window.CCTV.UI.showMessage('У вас нет прав на добавление записей', 'error');
            return;
        }
        
        document.getElementById('modal-title').textContent = 'Добавление камеры';
        this.buildAddFormFields();
    }
    
    buildAddFormFields() {
        fetch(`/api/structure/${this.tableName}`)
            .then(response => response.json())
            .then(data => {
                let fieldsHtml = `
                    <label>Регистратор *:</label>
                    <select name="idreg" required style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="">Выберите регистратор</option>
                        ${Object.entries(window.CCTV.AppState.registratorsCache).map(([regId, regName]) => 
                            `<option value="${regId}">${window.CCTV.UI.escapeHtml(regName)}</option>`
                        ).join('')}
                    </select>
                `;
                
                data.columns.forEach(col => {
                    const cleanCol = col.replace(' (NOT NULL)', '');
                    if (cleanCol === 'id' || cleanCol === 'idreg') return;
                    
                    const displayName = window.CCTV.Constants.COLUMN_NAMES[cleanCol] || cleanCol;
                    const isRequired = col.includes('NOT NULL');
                    
                    if (cleanCol === 'comment') {
                        fieldsHtml += `
                            <label>${window.CCTV.UI.escapeHtml(displayName)}${isRequired ? ' *' : ''}:</label>
                            <textarea name="${cleanCol}" rows="3" ${isRequired ? 'required' : ''} style="width: 100%; padding: 8px; margin: 5px 0;"></textarea>
                        `;
                    } else {
                        fieldsHtml += `
                            <label>${window.CCTV.UI.escapeHtml(displayName)}${isRequired ? ' *' : ''}:</label>
                            <input type="text" name="${cleanCol}" ${isRequired ? 'required' : ''} style="width: 100%; padding: 8px; margin: 5px 0;">
                        `;
                    }
                });
                
                document.getElementById('modal-fields').innerHTML = fieldsHtml;
                document.getElementById('modal').style.display = 'flex';
                document.getElementById('edit-form').onsubmit = (e) => {
                    e.preventDefault();
                    this.addRecord();
                };
            });
    }
    
    async addRecord() {
        const form = document.getElementById('edit-form');
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });
        delete data.id;
        
        const result = await window.CCTV.API.createData(this.tableName, data);
        if (result.success) {
            window.CCTV.UI.closeModal();
            window.CCTV.loadTable(this.tableName);
            window.CCTV.UI.showMessage('Запись успешно добавлена', 'success');
        } else {
            window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
        }
    }
    
    async showEditForm(id) {
        if (!window.CCTV.UI.canEditCurrentTable()) {
            window.CCTV.UI.showMessage('У вас нет прав на редактирование', 'error');
            return;
        }
        
        const data = await window.CCTV.API.fetchData(this.tableName, id);
        document.getElementById('modal-title').textContent = 'Редактирование камеры';
        
        let fieldsHtml = `
            <label>Регистратор *:</label>
            <select name="idreg" required style="width: 100%; padding: 8px; margin: 5px 0;">
                <option value="">Выберите регистратор</option>
                ${Object.entries(window.CCTV.AppState.registratorsCache).map(([regId, regName]) => 
                    `<option value="${regId}" ${regId == data.idreg ? 'selected' : ''}>${window.CCTV.UI.escapeHtml(regName)}</option>`
                ).join('')}
            </select>
        `;
        
        for (let key in data) {
            if (key === 'id' || key === 'idreg') continue;
            const displayName = window.CCTV.Constants.COLUMN_NAMES[key] || key;
            let inputValue = data[key] || '';
            
            if (key === 'comment') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(displayName)}:</label>
                    <textarea name="${key}" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;">${window.CCTV.UI.escapeHtml(inputValue)}</textarea>
                `;
            } else {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(displayName)}:</label>
                    <input type="text" name="${key}" value="${window.CCTV.UI.escapeHtml(inputValue)}" style="width: 100%; padding: 8px; margin: 5px 0;">
                `;
            }
        }
        fieldsHtml += `<input type="hidden" name="id" value="${id}">`;
        
        document.getElementById('modal-fields').innerHTML = fieldsHtml;
        document.getElementById('modal').style.display = 'flex';
        
        document.getElementById('edit-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(document.getElementById('edit-form'));
            const submitData = {};
            formData.forEach((value, key) => {
                if (key !== 'id') submitData[key] = value;
            });
            
            const result = await window.CCTV.API.saveData(this.tableName, id, submitData);
            if (result.success) {
                window.CCTV.UI.closeModal();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.showMessage('Запись успешно обновлена', 'success');
            } else {
                window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
            }
        };
    }
}

window.CCTV.CamerasTable = new CamerasTable();