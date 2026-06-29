/**
 * cameras.js - Таблица камер (с валидацией порта по регистратору и уникальностью)
 */

class CamerasTable extends window.CCTV.BaseTable {
    constructor() {
        super('cam_camers');
        this.currentRegistratorFilters = window.CCTV.AppState.currentRegistratorFilters;
        this.registratorsData = {};
    }

    async loadRegistratorsData() {
        const response = await fetch('/api/data/cam_registrators');
        const data = await response.json();
        if (data.error) {
            window.CCTV.UI.showMessage('Ошибка загрузки регистраторов: ' + data.error, 'error');
            this.registratorsData = {};
            return;
        }
        this.registratorsData = {};
        data.data.forEach(reg => {
            this.registratorsData[reg.id] = {
                count_ports: reg.count_ports,
                name: `АП${reg.ap}_${reg.id_reg_on_ap}`
            };
        });
    }

    async loadData() {
        await Promise.all([
            window.CCTV.API.loadRegistratorsCache(),
            this.loadRegistratorsData()
        ]);
        const response = await fetch(`/api/data/${this.tableName}`);
        const data = await response.json();
        if (data.error) {
            window.CCTV.UI.showMessage('Ошибка загрузки камер: ' + data.error, 'error');
            this.originalData = [];
            return [];
        }
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
            Найдено записей: ${sortedData.length}
        </div>`;
        html += '<table id="data-table"><thead><tr>';
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
                    const regInfo = this.registratorsData[value]?.name || `Регистратор #${value}`;
                    html += `<td>${window.CCTV.UI.escapeHtml(regInfo)}</td>`;
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
        const registratorsList = Object.entries(this.registratorsData).map(([id, reg]) => ({
            id: parseInt(id),
            name: reg.name
        })).sort((a, b) => a.name.localeCompare(b.name));
        const totalRegistrators = registratorsList.length;
        const selectedCount = this.currentRegistratorFilters.size;
        const allSelected = (selectedCount === totalRegistrators && totalRegistrators > 0);
        const isAllActive = (selectedCount === 0) || allSelected;
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
        const registratorsList = Object.keys(this.registratorsData).map(id => parseInt(id));
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
        const labels = {
            idreg: 'Регистратор',
            port: 'Порт',
            type: 'Тип камеры',
            location: 'Расположение',
            expansion: 'Расширение',
            comment: 'Примечание'
        };
        let fieldsHtml = `
            <label>${labels.idreg} *:</label>
            <select name="idreg" id="idreg" required style="width: 100%; padding: 8px; margin: 5px 0;" onchange="window.CCTV.CamerasTable.onRegistratorChange()">
                <option value="">Выберите регистратор</option>
                ${Object.entries(this.registratorsData).map(([regId, reg]) => 
                    `<option value="${regId}">${window.CCTV.UI.escapeHtml(reg.name)} (портов: ${reg.count_ports})</option>`
                ).join('')}
            </select>
            <label>${labels.port} *:</label>
            <input type="number" name="port" id="port" required min="1" step="1" style="width: 100%; padding: 8px; margin: 5px 0;">
            <label>${labels.type} *:</label>
            <select name="type" id="type" required style="width: 100%; padding: 8px; margin: 5px 0;">
                <option value="">Выберите тип</option>
                <option value="Аналоговая">Аналоговая</option>
                <option value="Цифровая">Цифровая</option>
            </select>
            <label>${labels.location} *:</label>
            <input type="text" name="location" id="location" required style="width: 100%; padding: 8px; margin: 5px 0;">
            <label>${labels.expansion} *:</label>
            <input type="text" name="expansion" id="expansion" required style="width: 100%; padding: 8px; margin: 5px 0;">
            <label>${labels.comment}:</label>
            <textarea name="comment" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;"></textarea>
        `;
        document.getElementById('modal-fields').innerHTML = fieldsHtml;
        document.getElementById('modal').style.display = 'flex';
        document.getElementById('edit-form').onsubmit = (e) => {
            e.preventDefault();
            this.addRecord();
        };
        this.onRegistratorChange();
    }

    async onRegistratorChange() {
        const regSelect = document.getElementById('idreg');
        const portInput = document.getElementById('port');
        if (!regSelect || !portInput) return;
        const regId = regSelect.value;
        if (regId) {
            const reg = this.registratorsData[regId];
            if (reg) {
                portInput.max = reg.count_ports;
                portInput.placeholder = `1-${reg.count_ports}`;
            } else {
                portInput.removeAttribute('max');
                portInput.placeholder = '1-32';
            }
        } else {
            portInput.removeAttribute('max');
            portInput.placeholder = '1-32';
        }
    }

    async addRecord() {
        const form = document.getElementById('edit-form');
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });
        delete data.id;

        const regId = parseInt(data.idreg);
        const port = parseInt(data.port);
        if (isNaN(port)) {
            window.CCTV.UI.showMessage('Порт должен быть числом', 'error');
            return;
        }
        const reg = this.registratorsData[regId];
        if (!reg) {
            window.CCTV.UI.showMessage('Выберите регистратор', 'error');
            return;
        }
        if (port < 1 || port > reg.count_ports) {
            window.CCTV.UI.showMessage(`Порт должен быть от 1 до ${reg.count_ports} для выбранного регистратора`, 'error');
            return;
        }

        const exists = this.originalData.some(cam => cam.idreg == regId && cam.port == port);
        if (exists) {
            window.CCTV.UI.showMessage(`Порт ${port} уже занят на этом регистраторе`, 'error');
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
        document.getElementById('modal-title').textContent = 'Редактирование камеры';

        const labels = {
            idreg: 'Регистратор',
            port: 'Порт',
            type: 'Тип камеры',
            location: 'Расположение',
            expansion: 'Расширение',
            comment: 'Примечание'
        };

        let fieldsHtml = `
            <label>${labels.idreg} *:</label>
            <select name="idreg" id="idreg-edit" required style="width: 100%; padding: 8px; margin: 5px 0;" onchange="window.CCTV.CamerasTable.onRegistratorChangeEdit()">
                <option value="">Выберите регистратор</option>
                ${Object.entries(this.registratorsData).map(([regId, reg]) => 
                    `<option value="${regId}" ${regId == data.idreg ? 'selected' : ''}>${window.CCTV.UI.escapeHtml(reg.name)} (портов: ${reg.count_ports})</option>`
                ).join('')}
            </select>
        `;

        for (let key in data) {
            if (key === 'id' || key === 'version' || key === 'idreg') continue;
            let value = data[key] || '';
            const label = labels[key] || key;
            if (key === 'port') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <input type="number" name="${key}" id="port-edit" value="${value}" min="1" step="1" style="width: 100%; padding: 8px; margin: 5px 0;">
                `;
            } else if (key === 'type') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <select name="${key}" style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="Аналоговая" ${value === 'Аналоговая' ? 'selected' : ''}>Аналоговая</option>
                        <option value="Цифровая" ${value === 'Цифровая' ? 'selected' : ''}>Цифровая</option>
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

        this.onRegistratorChangeEdit();

        document.getElementById('edit-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(document.getElementById('edit-form'));
            const submitData = {};
            formData.forEach((value, key) => {
                if (key !== 'id') submitData[key] = value;
            });
            submitData.version = this.currentEditVersion;

            const regId = parseInt(submitData.idreg);
            const port = parseInt(submitData.port);
            if (isNaN(port)) {
                window.CCTV.UI.showMessage('Порт должен быть числом', 'error');
                return;
            }
            const reg = this.registratorsData[regId];
            if (!reg) {
                window.CCTV.UI.showMessage('Выберите регистратор', 'error');
                return;
            }
            if (port < 1 || port > reg.count_ports) {
                window.CCTV.UI.showMessage(`Порт должен быть от 1 до ${reg.count_ports} для выбранного регистратора`, 'error');
                return;
            }
            const exists = this.originalData.some(cam => cam.idreg == regId && cam.port == port && cam.id != id);
            if (exists) {
                window.CCTV.UI.showMessage(`Порт ${port} уже занят на этом регистраторе`, 'error');
                return;
            }

            const result = await window.CCTV.API.saveData(this.tableName, id, submitData);
            if (result.success) {
                window.CCTV.UI.closeModal();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.showMessage('Запись успешно обновлена', 'success');
            } else if (result.status === 409 || (result.error && result.error.includes('конфликт'))) {
                window.CCTV.UI.showMessage('⚠️ Запись была изменена другим пользователем. Обновите страницу.', 'error');
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.closeModal();
            } else {
                window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
            }
        };
    }

    async onRegistratorChangeEdit() {
        const regSelect = document.getElementById('idreg-edit');
        const portInput = document.getElementById('port-edit');
        if (!regSelect || !portInput) return;
        const regId = regSelect.value;
        if (regId) {
            const reg = this.registratorsData[regId];
            if (reg) {
                portInput.max = reg.count_ports;
                portInput.placeholder = `1-${reg.count_ports}`;
                let currentPort = parseInt(portInput.value);
                if (!isNaN(currentPort) && (currentPort < 1 || currentPort > reg.count_ports)) {
                    portInput.setCustomValidity(`Порт должен быть от 1 до ${reg.count_ports}`);
                } else {
                    portInput.setCustomValidity('');
                }
            } else {
                portInput.removeAttribute('max');
                portInput.placeholder = '1-32';
            }
        } else {
            portInput.removeAttribute('max');
            portInput.placeholder = '1-32';
        }
    }
}

window.CCTV.CamerasTable = new CamerasTable();