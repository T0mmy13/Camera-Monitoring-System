/**
 * registrators.js - Таблица регистраторов
 */

class RegistratorsTable extends window.CCTV.BaseTable {
    constructor() {
        super('cam_registrators');
        this.currentApFilter = window.CCTV.AppState.currentApFilter;
    }
    
    async loadData() {
        const response = await fetch(`/api/data/${this.tableName}`);
        const data = await response.json();
        this.originalData = data.data.map(reg => ({
            ...reg,
            registrator_full: window.CCTV.UI.getRegistratorFullName(reg)
        }));
        return this.originalData;
    }
    
    getUniqueAPs() {
        const aps = new Set();
        this.originalData.forEach(reg => {
            aps.add(reg.ap);
        });
        return Array.from(aps).sort((a, b) => a - b);
    }
    
    applyApFilter(data) {
        if (this.currentApFilter === null) return data;
        return data.filter(reg => reg.ap === this.currentApFilter);
    }
    
    render() {
        let workingData = [...this.originalData];
        workingData = this.applyApFilter(workingData);
        let filteredData = this.applyFilters(workingData);
        let sortedData = this.applySorting(filteredData);
        
        if (sortedData.length === 0) {
            document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center;">Нет данных</p>';
            return;
        }
        
        const columnsToDisplay = window.CCTV.Constants.COLUMN_ORDER['cam_registrators'];
        
        let html = `<div style="padding: 10px 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 8px 8px 0 0; font-size: 13px; color: #555;">
            📊 Найдено записей: ${sortedData.length}
        </div>`;
        
        html += '<table id="data-table"><thead><tr>';
        columnsToDisplay.forEach(col => {
            const displayName = window.CCTV.Constants.COLUMN_NAMES[col] || col;
            const canFilter = !window.CCTV.Constants.NO_FILTER_COLUMNS[this.tableName]?.includes(col);
            
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
                html += `<td>${window.CCTV.UI.escapeHtml(value)}</td>`;
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
        container.style.flexWrap = 'wrap';
        container.style.alignItems = 'center';
        container.style.gap = '8px';
        container.style.background = 'white';
        container.style.padding = '12px 15px';
        container.style.borderRadius = '8px';
        container.style.marginBottom = '20px';
        container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        
        const uniqueAPs = this.getUniqueAPs();
        let buttonsHtml = '<span class="filter-buttons-title">Фильтр по АП:</span>';
        buttonsHtml += `<button class="filter-btn ${this.currentApFilter === null ? 'all-active' : ''}" onclick="window.CCTV.RegistratorsTable.filterByAP(null)">Все АП</button>`;
        
        uniqueAPs.forEach(ap => {
            const isActive = this.currentApFilter === ap;
            buttonsHtml += `<button class="filter-btn ${isActive ? 'active' : ''}" onclick="window.CCTV.RegistratorsTable.filterByAP(${ap})">АП${ap}</button>`;
        });
        
        buttonsHtml += `<button class="reset-filters-icon" onclick="window.resetAllFilters()" title="Сбросить все фильтры">↻</button>`;
        
        container.innerHTML = buttonsHtml;
    }
    
    filterByAP(ap) {
        if (this.currentApFilter === ap) {
            this.currentApFilter = null;
        } else {
            this.currentApFilter = ap;
        }
        window.CCTV.AppState.currentApFilter = this.currentApFilter;
        window.CCTV.loadTable(this.tableName);
        window.CCTV.AppState.saveState();
    }
    
    showAddForm() {
        if (!window.CCTV.UI.canEditCurrentTable()) {
            window.CCTV.UI.showMessage('У вас нет прав на добавление записей', 'error');
            return;
        }
        
        document.getElementById('modal-title').textContent = 'Добавление регистратора';
        this.buildAddFormFields();
    }
    
    buildAddFormFields() {
        fetch(`/api/structure/${this.tableName}`)
            .then(response => response.json())
            .then(data => {
                let fieldsHtml = `
                    <label>АП (номер предприятия) *:</label>
                    <input type="number" name="ap" required style="width: 100%; padding: 8px; margin: 5px 0;">
                    <label>Номер регистратора на АП *:</label>
                    <input type="number" name="id_reg_on_ap" required style="width: 100%; padding: 8px; margin: 5px 0;">
                `;
                
                data.columns.forEach(col => {
                    const cleanCol = col.replace(' (NOT NULL)', '');
                    if (cleanCol === 'id' || cleanCol === 'ap' || cleanCol === 'id_reg_on_ap') return;
                    
                    const displayName = window.CCTV.Constants.COLUMN_NAMES[cleanCol] || cleanCol;
                    const isRequired = col.includes('NOT NULL');
                    fieldsHtml += `
                        <label>${window.CCTV.UI.escapeHtml(displayName)}${isRequired ? ' *' : ''}:</label>
                        <input type="text" name="${cleanCol}" ${isRequired ? 'required' : ''} style="width: 100%; padding: 8px; margin: 5px 0;">
                    `;
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

        // Запрашиваем блокировку
        const locked = await this.acquireLock(id);
        if (!locked) return;

        const data = await window.CCTV.API.fetchData(this.tableName, id);
        document.getElementById('modal-title').textContent = 'Редактирование регистратора';
        
        let fieldsHtml = '';
        for (let key in data) {
            if (key === 'id') continue;
            const displayName = window.CCTV.Constants.COLUMN_NAMES[key] || key;
            let inputValue = data[key] || '';
            
            if (key === 'ip') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(displayName)}:</label>
                    <input type="text" name="${key}" value="${window.CCTV.UI.escapeHtml(inputValue)}" placeholder="например: 192.168.1.100" style="width: 100%; padding: 8px; margin: 5px 0;">
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

        this.currentEditId = id;
        this.startLockRenewal(id);

        // Подменяем closeModal
        const originalClose = window.CCTV.UI.closeModal;
        window.CCTV.UI.closeModal = () => {
            this.cleanupLock();
            originalClose.call(window.CCTV.UI);
        };
        
        document.getElementById('edit-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(document.getElementById('edit-form'));
            const submitData = {};
            formData.forEach((value, key) => {
                if (key !== 'id') submitData[key] = value;
            });
            
            const result = await window.CCTV.API.saveData(this.tableName, id, submitData);
            if (result.success) {
                this.cleanupLock();
                window.CCTV.UI.closeModal();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.showMessage('Запись успешно обновлена', 'success');
            } else {
                window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
            }
        };
    }
}

window.CCTV.RegistratorsTable = new RegistratorsTable();