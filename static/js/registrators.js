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
        if (data.error) {
            window.CCTV.UI.showMessage('Ошибка загрузки регистраторов: ' + data.error, 'error');
            this.originalData = [];
            return [];
        }
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
        const container = document.getElementById('table-content');
        if (!container) return;
        
        if (sortedData.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center;">Нет данных</p>';
            return;
        }
        
        const columnsToDisplay = ['registrator_full', 'ip', 'type', 'count_ports', 'extensions', 'comment', 'condition'];
        
        let html = `<div style="padding: 10px 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 8px 8px 0 0; font-size: 13px; color: #555;">
            Найдено записей: ${sortedData.length}
        </div>`;
        html += '<table id="data-table" style="width:100%; border-collapse:collapse;">';
        html += '<thead><tr>';
        for (let col of columnsToDisplay) {
            let displayName = window.CCTV.Constants.COLUMN_NAMES[col] || col;
            html += `<th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd; background: #34495e; color: white;">${window.CCTV.UI.escapeHtml(displayName)}</th>`;
        }
        html += '</tr></thead><tbody>';
        
        for (let row of sortedData) {
            html += '<tr data-id="' + row.id + '">';
            for (let col of columnsToDisplay) {
                let value = row[col];
                if (value === null || value === undefined) value = '';
                html += `<td style="padding: 12px; border-bottom: 1px solid #ddd;">${window.CCTV.UI.escapeHtml(String(value))}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }
    
    buildFiltersUI() {
        const container = document.getElementById('filter-buttons-container');
        if (!container) return;
        
        container.style.cssText = '';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '8px';
        container.style.background = 'white';
        container.style.padding = '12px 15px';
        container.style.borderRadius = '8px';
        container.style.marginBottom = '20px';
        container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        container.style.overflowX = 'auto';
        container.style.whiteSpace = 'nowrap';
        container.style.flexWrap = 'nowrap';
        
        const uniqueAPs = this.getUniqueAPs();
        let buttonsHtml = '<span class="filter-buttons-title" style="flex-shrink: 0;">Фильтр по АП:</span>';
        buttonsHtml += `<button class="filter-btn ${this.currentApFilter === null ? 'all-active' : ''}" onclick="window.CCTV.RegistratorsTable.filterByAP(null)">Все АП</button>`;
        uniqueAPs.forEach(ap => {
            const isActive = this.currentApFilter === ap;
            buttonsHtml += `<button class="filter-btn ${isActive ? 'active' : ''}" onclick="window.CCTV.RegistratorsTable.filterByAP(${ap})">АП${ap}</button>`;
        });
        buttonsHtml += `<button class="reset-filters-icon" onclick="window.resetAllFilters()" title="Сбросить все фильтры" style="flex-shrink: 0;">↻</button>`;
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
        const labels = {
            ap: 'АП (номер предприятия)',
            id_reg_on_ap: 'Номер регистратора на АП',
            ip: 'IP-адрес',
            type: 'Тип регистратора',
            count_ports: 'Количество портов',
            extensions: 'Расширения',
            comment: 'Примечание',
            condition: 'Состояние'
        };
        let fieldsHtml = `
            <label>${labels.ap} *:</label>
            <input type="number" name="ap" id="ap" required min="1" max="999" style="width: 100%; padding: 8px; margin: 5px 0;">
            <label>${labels.id_reg_on_ap} *:</label>
            <input type="number" name="id_reg_on_ap" id="id_reg_on_ap" required min="1" style="width: 100%; padding: 8px; margin: 5px 0;">
            <label>${labels.ip} *:</label>
            <input type="text" name="ip" id="ip" required placeholder="192.168.1.100" style="width: 100%; padding: 8px; margin: 5px 0;">
            <label>${labels.type} *:</label>
            <select name="type" id="type" required style="width: 100%; padding: 8px; margin: 5px 0;">
                <option value="">Выберите тип</option>
                <option value="Аналоговый">Аналоговый</option>
                <option value="Цифровой">Цифровой</option>
                <option value="Гибридный">Гибридный</option>
            </select>
            <label>${labels.count_ports} *:</label>
            <select name="count_ports" id="count_ports" required style="width: 100%; padding: 8px; margin: 5px 0;">
                <option value="">Выберите количество портов</option>
                <option value="4">4</option>
                <option value="8">8</option>
                <option value="16">16</option>
                <option value="32">32</option>
            </select>
            <label>${labels.extensions} *:</label>
            <input type="text" name="extensions" id="extensions" required style="width: 100%; padding: 8px; margin: 5px 0;">
            <label>${labels.comment}:</label>
            <textarea name="comment" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;"></textarea>
            <label>${labels.condition}:</label>
            <select name="condition" id="condition" style="width: 100%; padding: 8px; margin: 5px 0;">
                <option value="">Выберите состояние</option>
                <option value="работает">Работает</option>
                <option value="не работает">Не работает</option>
                <option value="на обслуживании">На обслуживании</option>
            </select>
        `;
        document.getElementById('modal-fields').innerHTML = fieldsHtml;
        document.getElementById('modal').style.display = 'flex';
        document.getElementById('edit-form').onsubmit = (e) => {
            e.preventDefault();
            this.addRecord();
        };
    }
    
    async addRecord() {
        const form = document.getElementById('edit-form');
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });
        delete data.id;
        
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$|^localhost$|^127\.0\.0\.1$/;
        if (data.ip && !ipPattern.test(data.ip)) {
            window.CCTV.UI.showMessage('Неверный формат IP-адреса', 'error');
            return;
        }
        
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
        this.currentEditVersion = data.version;
        document.getElementById('modal-title').textContent = 'Редактирование регистратора';
        
        const labels = {
            ap: 'АП (номер предприятия)',
            id_reg_on_ap: 'Номер регистратора на АП',
            ip: 'IP-адрес',
            type: 'Тип регистратора',
            count_ports: 'Количество портов',
            extensions: 'Расширения',
            comment: 'Примечание',
            condition: 'Состояние'
        };
        
        let fieldsHtml = '';
        for (let key in data) {
            if (key === 'id' || key === 'version') continue;
            let value = data[key] || '';
            const label = labels[key] || key;
            if (key === 'ap' || key === 'id_reg_on_ap') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <input type="number" name="${key}" value="${value}" min="1" style="width: 100%; padding: 8px; margin: 5px 0;">
                `;
            } else if (key === 'ip') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <input type="text" name="${key}" value="${window.CCTV.UI.escapeHtml(value)}" placeholder="192.168.1.100" style="width: 100%; padding: 8px; margin: 5px 0;">
                `;
            } else if (key === 'type') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <select name="${key}" style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="Аналоговый" ${value === 'Аналоговый' ? 'selected' : ''}>Аналоговый</option>
                        <option value="Цифровой" ${value === 'Цифровой' ? 'selected' : ''}>Цифровой</option>
                        <option value="Гибридный" ${value === 'Гибридный' ? 'selected' : ''}>Гибридный</option>
                    </select>
                `;
            } else if (key === 'count_ports') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <select name="${key}" style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="4" ${value == 4 ? 'selected' : ''}>4</option>
                        <option value="8" ${value == 8 ? 'selected' : ''}>8</option>
                        <option value="16" ${value == 16 ? 'selected' : ''}>16</option>
                        <option value="32" ${value == 32 ? 'selected' : ''}>32</option>
                    </select>
                `;
            } else if (key === 'condition') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <select name="${key}" style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="">Не выбрано</option>
                        <option value="работает" ${value === 'работает' ? 'selected' : ''}>Работает</option>
                        <option value="не работает" ${value === 'не работает' ? 'selected' : ''}>Не работает</option>
                        <option value="на обслуживании" ${value === 'на обслуживании' ? 'selected' : ''}>На обслуживании</option>
                    </select>
                `;
            } else if (key === 'comment') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <textarea name="${key}" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;">${window.CCTV.UI.escapeHtml(value)}</textarea>
                `;
            } else {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <input type="text" name="${key}" value="${window.CCTV.UI.escapeHtml(value)}" style="width: 100%; padding: 8px; margin: 5px 0;">
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
            submitData.version = this.currentEditVersion;
            
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$|^localhost$|^127\.0\.0\.1$/;
            if (submitData.ip && !ipPattern.test(submitData.ip)) {
                window.CCTV.UI.showMessage('Неверный формат IP-адреса', 'error');
                return;
            }
            
            const result = await window.CCTV.API.saveData(this.tableName, id, submitData);
            if (result.success) {
                window.CCTV.UI.closeModal();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.showMessage('Запись успешно обновлена', 'success');
            } else if (result.status === 409 || (result.error && result.error.includes('конфликт'))) {
                window.CCTV.UI.showMessage('Запись была изменена другим пользователем. Обновите страницу.', 'error');
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.closeModal();
            } else {
                window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
            }
        };
    }
}

window.CCTV.RegistratorsTable = new RegistratorsTable();