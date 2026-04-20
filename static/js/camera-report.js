/**
 * camera-report.js - Таблица отчётов камер (с оптимистической блокировкой)
 */

class CameraReportTable extends window.CCTV.BaseTable {
    constructor() {
        super('cam_camera_report');
        this.reportFilters = window.CCTV.AppState.reportFilters;
    }
    
    async loadData() {
        await Promise.all([
            window.CCTV.API.loadCamerasCache(),
            window.CCTV.API.loadRegistratorsCache()
        ]);
        const response = await fetch(`/api/data/${this.tableName}`);
        const data = await response.json();
        this.originalData = data.data;
        return this.originalData;
    }
    
    applyReportDataFilters(data) {
        return data.filter(row => {
            const rowDate = window.CCTV.UI.normalizeDate(row.recording_date);
            let passed = true;
            if (this.reportFilters.startDate && rowDate < this.reportFilters.startDate) passed = false;
            if (passed && this.reportFilters.endDate && rowDate > this.reportFilters.endDate) passed = false;
            const cam = window.CCTV.AppState.camerasCache[row.id_cam];
            if (!cam) return false;
            if (passed && this.reportFilters.apFilters.size > 0) {
                let regAp = null;
                for (let [regId, regName] of Object.entries(window.CCTV.AppState.registratorsCache)) {
                    if (regId == cam.idreg) {
                        const match = regName.match(/АП(\d+)_/);
                        if (match) regAp = parseInt(match[1]);
                        break;
                    }
                }
                if (!regAp || !this.reportFilters.apFilters.has(regAp)) passed = false;
            }
            if (passed && this.reportFilters.registratorFilters.size > 0) {
                if (!this.reportFilters.registratorFilters.has(cam.idreg)) passed = false;
            }
            if (passed && this.reportFilters.conditionFilters.size > 0) {
                if (!this.reportFilters.conditionFilters.has(row.condition)) passed = false;
            }
            return passed;
        });
    }
    
    formatCameraDisplay(cam) {
        if (!cam) return '—';
        const regFullName = window.CCTV.AppState.registratorsCache[cam.idreg];
        if (!regFullName) return `CAM${cam.port}`;
        const match = regFullName.match(/АП(\d+)_(\d+)/);
        if (!match) return `CAM${cam.port}`;
        const apNumber = match[1];
        const regNumber = match[2];
        const camPort = cam.port;
        const apFilterActive = this.reportFilters.apFilters.size > 0;
        const regFilterActive = this.reportFilters.registratorFilters.size > 0;
        if (apFilterActive && regFilterActive) return `${camPort}`;
        else if (apFilterActive && !regFilterActive) return `${regNumber}_${camPort}`;
        else return `АП${apNumber}_${regNumber}_${camPort}`;
    }
    
    render() {
        let workingData = [...this.originalData];
        workingData = this.applyReportDataFilters(workingData);
        let filteredData = this.applyFilters(workingData);
        let sortedData = this.applySorting(filteredData);
        if (sortedData.length === 0) {
            document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center;">Нет данных</p>';
            return;
        }
        const columnsToDisplay = window.CCTV.Constants.COLUMN_ORDER['cam_camera_report'];
        let html = `<div style="padding: 10px 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 8px 8px 0 0; font-size: 13px; color: #555;">
            📊 Найдено записей: ${sortedData.length}
        </div>`;
        html += '<table id="data-table"><thead><tr>';
        columnsToDisplay.forEach(col => {
            const displayName = window.CCTV.Constants.COLUMN_NAMES[col] || col;
            html += `<th style="position: relative;">
                <div class="column-btn" style="cursor: default; opacity: 0.7;">
                    ${window.CCTV.UI.escapeHtml(displayName)}
                </div>
            </th>`;
        });
        html += '<tr></thead><tbody>';
        for (const row of sortedData) {
            html += '<tr data-id="' + row.id + '">';
            for (const col of columnsToDisplay) {
                let value = row[col];
                if (value === null) value = '';
                if (col === 'id_cam') {
                    const cam = window.CCTV.AppState.camerasCache[value];
                    if (cam) {
                        value = this.formatCameraDisplay(cam);
                    } else {
                        value = `Камера #${value}`;
                    }
                    html += `<td>${window.CCTV.UI.escapeHtml(value)}</td>`;
                } else if (col === 'recording_date') {
                    value = window.CCTV.UI.formatDateToDMY(value);
                    html += `<td>${window.CCTV.UI.escapeHtml(value)}</td>`;
                } else {
                    html += `<td>${window.CCTV.UI.escapeHtml(value)}</td>`;
                }
            }
            html += '</tr>';
        }
        html += '</tbody></tr>';
        document.getElementById('table-content').innerHTML = html;
    }
    
    buildFiltersUI() {
        const container = document.getElementById('filter-buttons-container');
        if (!container) return;
        const today = window.CCTV.UI.getTodayDate();
        if (!this.reportFilters.startDate) this.reportFilters.startDate = today;
        if (!this.reportFilters.endDate) this.reportFilters.endDate = today;
        const allAPs = window.CCTV.UI.getUniqueAPsFromCache();
        const allConditions = window.CCTV.Constants.CONDITION_OPTIONS;
        let registratorsData = Object.entries(window.CCTV.AppState.registratorsCache).map(([id, name]) => ({
            id: parseInt(id), name: name, ap: parseInt(name.match(/АП(\d+)_/)?.[1] || 0)
        }));
        let html = `
            <div class="filter-row" style="flex: 1;">
                <div class="filter-item">
                    <span class="filter-label">📅</span>
                    <input type="date" id="report-start-date" class="date-input-mini" value="${this.reportFilters.startDate}" max="${today}" onchange="window.CCTV.CameraReportTable.updateDateFilter()">
                    <span>—</span>
                    <input type="date" id="report-end-date" class="date-input-mini" value="${this.reportFilters.endDate}" max="${today}" onchange="window.CCTV.CameraReportTable.updateDateFilter()">
                </div>
                <div class="filter-item">
                    <span class="filter-label">🏭 Предприятие</span>
                    <select id="report-ap-select" class="filter-select-mini" onchange="window.CCTV.CameraReportTable.updateApFilter()">
                        <option value="">Все</option>
                        ${allAPs.map(ap => 
                            `<option value="${ap}" ${this.reportFilters.apFilters.has(ap) ? 'selected' : ''}>АП${ap}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="filter-item">
                    <span class="filter-label">🎥 Регистратор</span>
                    <select id="report-registrator-select" class="filter-select-mini" onchange="window.CCTV.CameraReportTable.updateRegistratorFilter()" ${this.reportFilters.apFilters.size === 0 ? 'disabled' : ''}>
                        <option value="">Все</option>
                        ${registratorsData
                            .filter(reg => this.reportFilters.apFilters.size === 0 || this.reportFilters.apFilters.has(reg.ap))
                            .map(reg => 
                                `<option value="${reg.id}" ${this.reportFilters.registratorFilters.has(reg.id) ? 'selected' : ''}>${window.CCTV.UI.escapeHtml(reg.name)}</option>`
                            ).join('')}
                    </select>
                </div>
                <div class="filter-item">
                    <span class="filter-label">📊 Состояние</span>
                    <select id="report-condition-select" class="filter-select-mini" multiple size="1" onchange="window.CCTV.CameraReportTable.updateConditionFilter()">
                        ${allConditions.map(condition => 
                            `<option value="${condition}" ${this.reportFilters.conditionFilters.has(condition) ? 'selected' : ''}>${condition}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            <button class="reset-filters-icon" onclick="window.resetAllFilters()" title="Сбросить все фильтры">↻</button>
        `;
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'space-between';
        const conditionSelect = document.getElementById('report-condition-select');
        if (conditionSelect) {
            conditionSelect.addEventListener('focus', function() { this.size = Math.min(this.options.length, 6); });
            conditionSelect.addEventListener('blur', function() { this.size = 1; });
            conditionSelect.addEventListener('change', function() { this.size = 1; });
        }
        const apSelect = document.getElementById('report-ap-select');
        if (apSelect) {
            apSelect.addEventListener('change', () => this.updateRegistratorSelectByAp());
        }
    }
    
    updateRegistratorSelectByAp() {
        const apSelect = document.getElementById('report-ap-select');
        const registratorSelect = document.getElementById('report-registrator-select');
        const selectedAp = apSelect.value ? parseInt(apSelect.value) : null;
        if (!selectedAp) {
            registratorSelect.disabled = true;
            registratorSelect.innerHTML = '<option value="">Все регистраторы</option>';
            this.updateApFilter();
            return;
        }
        registratorSelect.disabled = false;
        const filteredRegistrators = Object.entries(window.CCTV.AppState.registratorsCache)
            .filter(([regId, regName]) => {
                const match = regName.match(/АП(\d+)_/);
                return match && parseInt(match[1]) === selectedAp;
            })
            .map(([regId, regName]) => ({ id: parseInt(regId), name: regName }));
        let options = '<option value="">Все регистраторы</option>';
        filteredRegistrators.forEach(reg => {
            options += `<option value="${reg.id}">${window.CCTV.UI.escapeHtml(reg.name)}</option>`;
        });
        registratorSelect.innerHTML = options;
        this.updateApFilter();
    }
    
    updateDateFilter() {
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
        if (startDate && endDate && startDate > endDate) return;
        this.reportFilters.startDate = startDate;
        this.reportFilters.endDate = endDate;
        window.CCTV.loadTable(this.tableName);
        window.CCTV.AppState.saveState();
    }
    
    updateApFilter() {
        const select = document.getElementById('report-ap-select');
        const value = select.value;
        this.reportFilters.apFilters.clear();
        if (value) this.reportFilters.apFilters.add(parseInt(value));
        window.CCTV.loadTable(this.tableName);
        window.CCTV.AppState.saveState();
    }
    
    updateRegistratorFilter() {
        const select = document.getElementById('report-registrator-select');
        const value = select.value;
        this.reportFilters.registratorFilters.clear();
        if (value) this.reportFilters.registratorFilters.add(parseInt(value));
        window.CCTV.loadTable(this.tableName);
        window.CCTV.AppState.saveState();
    }
    
    updateConditionFilter() {
        const select = document.getElementById('report-condition-select');
        const selectedOptions = Array.from(select.selectedOptions);
        this.reportFilters.conditionFilters.clear();
        selectedOptions.forEach(opt => {
            if (opt.value) this.reportFilters.conditionFilters.add(opt.value);
        });
        window.CCTV.loadTable(this.tableName);
        window.CCTV.AppState.saveState();
    }
    
    showAddForm() {
        if (!window.CCTV.UI.canEditCurrentTable()) {
            window.CCTV.UI.showMessage('У вас нет прав на добавление записей', 'error');
            return;
        }
        document.getElementById('modal-title').textContent = 'Добавление записи';
        this.buildAddFormFields();
    }
    
    buildAddFormFields() {
        let fieldsHtml = `
            <label>Регистратор:</label>
            <select id="registrator-select" onchange="window.CCTV.CameraReportTable.updateCamerasByRegistrator()" style="width: 100%; padding: 8px; margin: 5px 0;">
                <option value="">Выберите регистратор</option>
                ${Object.entries(window.CCTV.AppState.registratorsCache).map(([regId, regName]) => 
                    `<option value="${regId}">${window.CCTV.UI.escapeHtml(regName)}</option>`
                ).join('')}
            </select>
            <label>Камера:</label>
            <select id="camera-select" name="id_cam" required style="width: 100%; padding: 8px; margin: 5px 0;" onchange="window.CCTV.CameraReportTable.onCameraSelect()">
                <option value="">Сначала выберите регистратор</option>
            </select>
            <div id="last-report-info" style="display: none; margin: 10px 0;"></div>
            <label>Состояние:</label>
            <select id="condition-select" name="condition" required onchange="window.CCTV.CameraReportTable.toggleBreakdownField()" style="width: 100%; padding: 8px; margin: 5px 0;">
                ${window.CCTV.Constants.CONDITION_OPTIONS.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
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
                        <input type="checkbox" id="hide-today-cameras" onchange="window.CCTV.CameraReportTable.updateCamerasByRegistrator()">
                        <span class="checkbox-text">🚫 Не показывать камеры, уже добавленные сегодня</span>
                    </label>
                </div>
            </div>
        `;
        document.getElementById('modal-fields').innerHTML = fieldsHtml;
        const breakdownDiv = document.getElementById('breakdown-multiselect');
        if (breakdownDiv) {
            breakdownDiv.innerHTML = this.createBreakdownSelect('breakdown-select-add', []);
        }
        document.getElementById('modal').style.display = 'flex';
        document.getElementById('edit-form').onsubmit = (e) => {
            e.preventDefault();
            this.addReportRecord();
        };
    }
    
    async updateCamerasByRegistrator() {
        const registratorSelect = document.getElementById('registrator-select');
        const cameraSelect = document.getElementById('camera-select');
        const hideTodayCheckbox = document.getElementById('hide-today-cameras');
        const selectedRegId = registratorSelect.value;
        if (!selectedRegId) {
            cameraSelect.innerHTML = '<option value="">Сначала выберите регистратор</option>';
            const lastReportDiv = document.getElementById('last-report-info');
            if (lastReportDiv) lastReportDiv.style.display = 'none';
            return;
        }
        const today = window.CCTV.UI.getTodayDate();
        const response = await fetch('/api/data/cam_camers');
        const data = await response.json();
        let filteredCams = data.data.filter(cam => cam.idreg == selectedRegId);
        if (hideTodayCheckbox && hideTodayCheckbox.checked) {
            const camerasWithTodayReports = new Set();
            const reportsResponse = await fetch('/api/data/cam_camera_report');
            const reportsData = await reportsResponse.json();
            reportsData.data.forEach(report => {
                const reportDate = window.CCTV.UI.normalizeDate(report.recording_date);
                if (reportDate === today) camerasWithTodayReports.add(report.id_cam);
            });
            filteredCams = filteredCams.filter(cam => !camerasWithTodayReports.has(cam.id));
        }
        let options = '<option value="">Выберите камеру</option>';
        filteredCams.forEach(cam => {
            const location = cam.location || 'без расположения';
            options += `<option value="${cam.id}">CAM${cam.port} (${window.CCTV.UI.escapeHtml(location)})</option>`;
        });
        cameraSelect.innerHTML = options;
        const lastReportDiv = document.getElementById('last-report-info');
        if (lastReportDiv) lastReportDiv.style.display = 'none';
    }
    
    async onCameraSelect() {
        await this.showLastReportInfo();
    }
    
    async showLastReportInfo() {
        const cameraSelect = document.getElementById('camera-select');
        const lastReportDiv = document.getElementById('last-report-info');
        if (!cameraSelect || !cameraSelect.value) {
            if (lastReportDiv) lastReportDiv.style.display = 'none';
            return;
        }
        const cameraId = cameraSelect.value;
        const lastReport = await this.getLastCameraReport(cameraId);
        if (lastReportDiv) {
            if (lastReport) {
                const date = window.CCTV.UI.formatDateToDMY(window.CCTV.UI.normalizeDate(lastReport.recording_date));
                let breakdownText = lastReport.breakdown ? ` (${lastReport.breakdown})` : '';
                lastReportDiv.innerHTML = `
                    <div style="background: #e9ecef; padding: 8px 12px; border-radius: 4px; margin-top: 10px; font-size: 12px;">
                        <strong>📋 Последняя запись:</strong><br>
                        📅 ${date} | ${lastReport.condition}${breakdownText}<br>
                        📝 ${window.CCTV.UI.escapeHtml(lastReport.comment || 'без комментария')}
                    </div>
                `;
                lastReportDiv.style.display = 'block';
            } else {
                lastReportDiv.style.display = 'none';
            }
        }
    }
    
    async getLastCameraReport(cameraId) {
        try {
            const response = await fetch(`/api/data/cam_camera_report`);
            const data = await response.json();
            const cameraReports = data.data
                .filter(report => report.id_cam == cameraId)
                .sort((a, b) => new Date(b.recording_date) - new Date(a.recording_date));
            return cameraReports.length > 0 ? cameraReports[0] : null;
        } catch (error) {
            console.error('Error getting last report:', error);
            return null;
        }
    }
    
    createBreakdownSelect(id, selectedValues = []) {
        let html = `<div class="breakdown-select" id="${id}" style="border: 1px solid #ddd; border-radius: 4px; max-height: 150px; overflow-y: auto;">`;
        window.CCTV.Constants.BREAKDOWN_OPTIONS.forEach(opt => {
            const isSelected = selectedValues.includes(opt);
            html += `
                <div class="breakdown-option ${isSelected ? 'selected' : ''}" 
                     data-value="${opt}"
                     style="padding: 8px; cursor: pointer; border-bottom: 1px solid #eee; ${isSelected ? 'background-color: #e0e0e0; color: #333; font-weight: 500;' : ''}"
                     onclick="window.CCTV.CameraReportTable.toggleBreakdownOption(this)">
                    ${opt}
                </div>
            `;
        });
        html += `</div>`;
        return html;
    }
    
    toggleBreakdownOption(element) {
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
    
    getSelectedBreakdowns(divId) {
        const container = document.getElementById(divId);
        if (!container) return [];
        const selected = [];
        container.querySelectorAll('.breakdown-option.selected').forEach(opt => {
            selected.push(opt.getAttribute('data-value'));
        });
        return selected;
    }
    
    clearBreakdownSelection(divId) {
        const container = document.getElementById(divId);
        if (!container) return;
        container.querySelectorAll('.breakdown-option').forEach(opt => {
            opt.classList.remove('selected');
            opt.style.backgroundColor = '';
            opt.style.color = '';
            opt.style.fontWeight = '';
        });
    }
    
    toggleBreakdownField() {
        const conditionSelect = document.getElementById('condition-select');
        const breakdownDiv = document.getElementById('breakdown-field');
        if (conditionSelect) {
            const selectedCondition = conditionSelect.value;
            breakdownDiv.style.display = (selectedCondition === 'Частично не исправна' || selectedCondition === 'Неисправна') ? 'block' : 'none';
            if (breakdownDiv.style.display === 'none') {
                this.clearBreakdownSelection('breakdown-select-add');
            }
        }
    }
    
    async addReportRecord() {
        const idCam = document.getElementById('camera-select').value;
        const condition = document.getElementById('condition-select').value;
        const comment = document.querySelector('textarea[name="comment"]').value;
        const selectedBreakdowns = this.getSelectedBreakdowns('breakdown-select-add');
        if (!idCam || !condition) {
            window.CCTV.UI.showMessage('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }
        const currentDate = window.CCTV.UI.getTodayDate();
        const promises = [];
        if (selectedBreakdowns.length === 0) {
            promises.push(API.createData(this.tableName, {
                id_cam: idCam, condition: condition, breakdown: '', comment: comment, recording_date: currentDate
            }));
        } else {
            selectedBreakdowns.forEach(breakdown => {
                promises.push(API.createData(this.tableName, {
                    id_cam: idCam, condition: condition, breakdown: breakdown, comment: comment, recording_date: currentDate
                }));
            });
        }
        try {
            const responses = await Promise.all(promises);
            const allSuccess = responses.every(r => r.success !== false);
            if (allSuccess) {
                window.CCTV.UI.closeModal();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.showMessage('Запись успешно добавлена', 'success');
            } else {
                window.CCTV.UI.showMessage('Ошибка при добавлении', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            window.CCTV.UI.showMessage('Ошибка при добавлении', 'error');
        }
    }
    
    async showEditForm(id) {
        if (!window.CCTV.UI.canEditCurrentTable()) {
            window.CCTV.UI.showMessage('У вас нет прав на редактирование', 'error');
            return;
        }
        try {
            const record = await window.CCTV.API.fetchData(this.tableName, id);
            this.currentEditId = id;
            this.currentEditVersion = record.version;
            
            const isAdmin = window.CCTV.AppState.userRole === 'admin';
            const isEditor = window.CCTV.AppState.userRole === 'editor';
            
            document.getElementById('modal-title').textContent = 'Редактирование отчёта';
            
            if (isAdmin) {
                const cam = window.CCTV.AppState.camerasCache[record.id_cam];
                const currentRegId = cam ? cam.idreg : null;
                const currentBreakdowns = record.breakdown ? record.breakdown.split(',') : [];
                let fieldsHtml = `
                    <label>Регистратор:</label>
                    <select id="registrator-select-edit" onchange="window.CCTV.CameraReportTable.updateCamerasByRegistratorForEdit()" style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="">Выберите регистратор</option>
                        ${Object.entries(window.CCTV.AppState.registratorsCache).map(([regId, regName]) => 
                            `<option value="${regId}" ${currentRegId == regId ? 'selected' : ''}>${window.CCTV.UI.escapeHtml(regName)}</option>`
                        ).join('')}
                    </select>
                    <label>Камера:</label>
                    <select id="camera-select-edit" name="id_cam" required style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="">Сначала выберите регистратор</option>
                    </select>
                    <label>Состояние:</label>
                    <select id="condition-select-edit" name="condition" required onchange="window.CCTV.CameraReportTable.toggleBreakdownFieldEdit()" style="width: 100%; padding: 8px; margin: 5px 0;">
                        ${window.CCTV.Constants.CONDITION_OPTIONS.map(opt => 
                            `<option value="${opt}" ${record.condition === opt ? 'selected' : ''}>${opt}</option>`
                        ).join('')}
                    </select>
                    <div id="breakdown-field-edit" style="display: ${(record.condition === 'Частично не исправна' || record.condition === 'Неисправна') ? 'block' : 'none'}; margin: 10px 0;">
                        <label>Поломка (нажмите для выбора, нажмите еще раз для отмены):</label>
                        <div id="breakdown-multiselect-edit" style="margin-top: 5px;"></div>
                    </div>
                    <label>Примечание:</label>
                    <textarea name="comment" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;">${window.CCTV.UI.escapeHtml(record.comment || '')}</textarea>
                    <input type="hidden" name="id" value="${id}">
                `;
                document.getElementById('modal-fields').innerHTML = fieldsHtml;
                const breakdownDiv = document.getElementById('breakdown-multiselect-edit');
                if (breakdownDiv) {
                    breakdownDiv.innerHTML = this.createBreakdownSelect('breakdown-select-edit', currentBreakdowns);
                }
                if (currentRegId) {
                    await this.updateCamerasByRegistratorForEdit(currentRegId, record.id_cam);
                }
                document.getElementById('edit-form').onsubmit = async (e) => {
                    e.preventDefault();
                    await this.updateReportRecordFull(id);
                };
            } else if (isEditor) {
                const cam = window.CCTV.AppState.camerasCache[record.id_cam];
                const cameraDisplay = this.formatCameraDisplay(cam);
                let fieldsHtml = `
                    <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                        <strong>Камера:</strong> ${window.CCTV.UI.escapeHtml(cameraDisplay)}<br>
                        <strong>Состояние:</strong> ${window.CCTV.UI.escapeHtml(record.condition)}<br>
                        <strong>Поломка:</strong> ${window.CCTV.UI.escapeHtml(record.breakdown || '—')}<br>
                        <strong>Дата:</strong> ${window.CCTV.UI.formatDateToDMY(record.recording_date)}
                    </div>
                    <label>Примечание (только для редактирования):</label>
                    <textarea name="comment" rows="4" style="width: 100%; padding: 8px; margin: 5px 0;">${window.CCTV.UI.escapeHtml(record.comment || '')}</textarea>
                    <input type="hidden" name="id" value="${id}">
                `;
                document.getElementById('modal-fields').innerHTML = fieldsHtml;
                document.getElementById('edit-form').onsubmit = async (e) => {
                    e.preventDefault();
                    const comment = document.querySelector('textarea[name="comment"]').value;
                    await this.updateReportRecordCommentOnly(id, comment);
                };
            }
            document.getElementById('modal').style.display = 'flex';
        } catch (error) {
            console.error('Error loading record for edit:', error);
            window.CCTV.UI.showMessage('Ошибка загрузки записи', 'error');
        }
    }
    
    async updateCamerasByRegistratorForEdit(registratorId, selectedCamId = null) {
        const cameraSelect = document.getElementById('camera-select-edit');
        if (!registratorId) {
            cameraSelect.innerHTML = '<option value="">Сначала выберите регистратор</option>';
            return;
        }
        const response = await fetch('/api/data/cam_camers');
        const data = await response.json();
        const filteredCams = data.data.filter(cam => cam.idreg == registratorId);
        let options = '<option value="">Выберите камеру</option>';
        filteredCams.forEach(cam => {
            const location = cam.location || 'без расположения';
            const selected = (selectedCamId == cam.id) ? 'selected' : '';
            options += `<option value="${cam.id}" ${selected}>CAM${cam.port} (${window.CCTV.UI.escapeHtml(location)})</option>`;
        });
        cameraSelect.innerHTML = options;
    }
    
    toggleBreakdownFieldEdit() {
        const conditionSelect = document.getElementById('condition-select-edit');
        const breakdownDiv = document.getElementById('breakdown-field-edit');
        if (conditionSelect) {
            const selectedCondition = conditionSelect.value;
            breakdownDiv.style.display = (selectedCondition === 'Частично не исправна' || selectedCondition === 'Неисправна') ? 'block' : 'none';
            if (breakdownDiv.style.display === 'none') {
                this.clearBreakdownSelection('breakdown-select-edit');
            }
        }
    }
    
    async updateReportRecordFull(id) {
        const idCam = document.getElementById('camera-select-edit').value;
        const condition = document.getElementById('condition-select-edit').value;
        const comment = document.querySelector('textarea[name="comment"]').value;
        const selectedBreakdowns = this.getSelectedBreakdowns('breakdown-select-edit');
        if (!idCam || !condition) {
            window.CCTV.UI.showMessage('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }
        const currentDate = window.CCTV.UI.getTodayDate();
        try {
            await window.CCTV.API.deleteData(this.tableName, id);
            const promises = [];
            if (selectedBreakdowns.length === 0) {
                promises.push(window.CCTV.API.createData(this.tableName, {
                    id_cam: idCam, condition: condition, breakdown: '', comment: comment, recording_date: currentDate
                }));
            } else {
                selectedBreakdowns.forEach(breakdown => {
                    promises.push(window.CCTV.API.createData(this.tableName, {
                        id_cam: idCam, condition: condition, breakdown: breakdown, comment: comment, recording_date: currentDate
                    }));
                });
            }
            await Promise.all(promises);
            window.CCTV.UI.closeModal();
            window.CCTV.loadTable(this.tableName);
            window.CCTV.UI.showMessage('Запись успешно обновлена', 'success');
        } catch (error) {
            console.error('Error updating report:', error);
            window.CCTV.UI.showMessage('Ошибка при обновлении', 'error');
        }
    }
    
    async updateReportRecordCommentOnly(id, comment) {
        try {
            const result = await window.CCTV.API.saveData(this.tableName, id, { 
                comment: comment,
                version: this.currentEditVersion
            });
            if (result.success) {
                window.CCTV.UI.closeModal();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.showMessage('Примечание успешно обновлено', 'success');
            } else if (result.status === 409 || (result.error && result.error.includes('конфликт'))) {
                window.CCTV.UI.showMessage('⚠️ Запись была изменена другим пользователем. Обновите страницу.', 'error');
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.closeModal();
            } else {
                window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error updating comment:', error);
            window.CCTV.UI.showMessage('Ошибка при обновлении', 'error');
        }
    }
    
    async exportToExcel() {
        if (Object.keys(window.CCTV.AppState.camerasCache).length === 0 || Object.keys(window.CCTV.AppState.registratorsCache).length === 0) {
            window.CCTV.UI.showMessage('Загрузка данных, повторите попытку через секунду', 'error');
            await Promise.all([window.CCTV.API.loadCamerasCache(), window.CCTV.API.loadRegistratorsCache()]);
            this.exportToExcel();
            return;
        }
        let workingData = [...this.originalData];
        workingData = this.applyReportDataFilters(workingData);
        let filteredData = this.applyFilters(workingData);
        let sortedData = this.applySorting(filteredData);
        if (sortedData.length === 0) {
            window.CCTV.UI.showMessage('Нет данных для экспорта', 'error');
            return;
        }
        const exportData = [];
        for (const report of sortedData) {
            const cam = window.CCTV.AppState.camerasCache[report.id_cam];
            if (!cam) continue;
            const regFullName = window.CCTV.AppState.registratorsCache[cam.idreg];
            let apNumber = '', regNumber = '';
            if (regFullName) {
                const match = regFullName.match(/АП(\d+)_(\d+)/);
                if (match) {
                    apNumber = match[1];
                    regNumber = match[2];
                }
            }
            exportData.push({
                'АП': apNumber,
                'Регистратор': regNumber,
                'Камера': cam.port || '',
                'Тип': cam.type || '',
                'Расположение': cam.location || '',
                'Расширение': cam.expansion || '',
                'Состояние': report.condition || '',
                'Тип поломки': report.breakdown || '',
                'Дата записи': window.CCTV.UI.formatDateToDMY(report.recording_date)
            });
        }
        try {
            const response = await fetch('/export_excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(exportData)
            });
            if (!response.ok) {
                let errorText = await response.text();
                window.CCTV.UI.showMessage(`Ошибка экспорта (${response.status})`, 'error');
                return;
            }
            const blob = await response.blob();
            if (!blob.type.includes('spreadsheetml.sheet')) {
                window.CCTV.UI.showMessage('Сервер вернул некорректный файл', 'error');
                return;
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `camera_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            window.CCTV.UI.showMessage(`✅ Экспортировано ${exportData.length} записей`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            window.CCTV.UI.showMessage('Ошибка при экспорте', 'error');
        }
    }
}

window.CCTV.CameraReportTable = new CameraReportTable();