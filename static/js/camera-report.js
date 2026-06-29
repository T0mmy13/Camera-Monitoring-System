/**
 * camera-report.js - Таблица отчётов камер (группировка по камере+день)
 * Изменения:
 * - в формах используется CONDITION_OPTIONS_FOR_FORMS (без "На текущий момент")
 * - фильтр "На текущий момент" не сбрасывает выбранные АП и учитывает их при фильтрации
 * - при активном режиме "На текущий момент" даты игнорируются, а АП/регистраторы/состояния работают
 * - фильтр по АП теперь позволяет выбрать только один АП или все (множественный выбор отключён)
 * - сортировка по умолчанию: по регистратору (АП+номер) и порту камеры
 */

class CameraReportTable extends window.CCTV.BaseTable {
    constructor() {
        super('cam_camera_report');
        this.reportFilters = window.CCTV.AppState.reportFilters;
        this.regContainer = null;
        this.lastSelectedRegistratorId = null;
        this.popup = null;
        this.showLatestOnly = false;
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
        let filtered = data.filter(row => {
            const cam = window.CCTV.AppState.camerasCache[row.id_cam];
            if (!cam) return false;
            let passed = true;
            if (this.reportFilters.apFilters.size > 0) {
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

        if (this.showLatestOnly) {
            const maxDatePerCam = {};
            filtered.forEach(row => {
                const camId = row.id_cam;
                const date = window.CCTV.UI.normalizeDate(row.recording_date);
                if (!maxDatePerCam[camId] || date > maxDatePerCam[camId]) {
                    maxDatePerCam[camId] = date;
                }
            });
            return filtered.filter(row => {
                const camId = row.id_cam;
                const date = window.CCTV.UI.normalizeDate(row.recording_date);
                return date === maxDatePerCam[camId];
            });
        } else {
            return filtered.filter(row => {
                const rowDate = window.CCTV.UI.normalizeDate(row.recording_date);
                let passed = true;
                if (this.reportFilters.startDate && rowDate < this.reportFilters.startDate) passed = false;
                if (passed && this.reportFilters.endDate && rowDate > this.reportFilters.endDate) passed = false;
                return passed;
            });
        }
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

    // ========== ИСПРАВЛЕННАЯ СОРТИРОВКА ПО УМОЛЧАНИЮ ==========
    applySorting(data) {
        // Если не задана пользовательская сортировка, сортируем по регистратору и порту
        if (!this.currentSort.column || !this.currentSort.order) {
            return [...data].sort((a, b) => {
                const camA = window.CCTV.AppState.camerasCache[a.id_cam];
                const camB = window.CCTV.AppState.camerasCache[b.id_cam];
                if (!camA || !camB) return (camA ? -1 : 1);
                
                const regNameA = window.CCTV.AppState.registratorsCache[camA.idreg] || '';
                const regNameB = window.CCTV.AppState.registratorsCache[camB.idreg] || '';
                
                // Сначала по регистратору (АП + номер)
                if (regNameA !== regNameB) {
                    return regNameA.localeCompare(regNameB);
                }
                // Затем по порту камеры
                return camA.port - camB.port;
            });
        }
        // Если задана пользовательская сортировка – используем базовый метод
        return super.applySorting(data);
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

        const groups = new Map();
        sortedData.forEach(row => {
            const key = row.id_cam + '|' + row.recording_date;
            if (!groups.has(key)) {
                groups.set(key, {
                    id_cam: row.id_cam,
                    recording_date: row.recording_date,
                    records: []
                });
            }
            groups.get(key).records.push(row);
        });

        const groupList = Array.from(groups.values());

        const columnsToDisplay = ['id_cam', 'condition', 'breakdown', 'recording_date', 'actions'];
        const columnNames = {
            'id_cam': 'Камера',
            'condition': 'Состояние',
            'breakdown': 'Поломки',
            'recording_date': 'Дата',
            'actions': 'Комментарий'
        };

        let html = `<div style="padding: 10px 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 8px 8px 0 0; font-size: 13px; color: #555;">
            Найдено записей: ${sortedData.length} (сгруппировано в ${groupList.length} строк)
        </div>`;
        html += '<table id="data-table" class="no-select"><thead><tr>';
        columnsToDisplay.forEach(col => {
            html += `<th style="position: relative;">
                <div class="column-btn" style="cursor: default; opacity: 0.7;">
                    ${window.CCTV.UI.escapeHtml(columnNames[col] || col)}
                </div>
            </th>`;
        });
        html += '</tr></thead><tbody>';

        let prevCamId = null;

        for (const group of groupList) {
            const records = group.records;
            const cam = window.CCTV.AppState.camerasCache[group.id_cam];

            const conditions = records.map(r => r.condition).filter(Boolean);
            const uniqueConditions = [...new Set(conditions)];
            let conditionDisplay = uniqueConditions.length === 1 ? uniqueConditions[0] : 'разное';

            const breakdowns = records
                .map(r => r.breakdown)
                .filter(b => b && b.trim() !== '')
                .map(b => b.trim());
            const uniqueBreakdowns = [...new Set(breakdowns)];
            const breakdownDisplay = uniqueBreakdowns.length > 0 ? uniqueBreakdowns.join(', ') : '—';

            const dateDisplay = window.CCTV.UI.formatDateToDMY(group.recording_date);

            if (prevCamId !== null && prevCamId !== group.id_cam) {
                html += `<tr style="border-top: 2px solid #000;"><td colspan="${columnsToDisplay.length}" style="padding:0; height:2px;"></td></tr>`;
            }
            prevCamId = group.id_cam;

            const groupId = group.id_cam + '|' + group.recording_date;

            html += '<tr data-group="' + groupId + '">';

            if (cam) {
                html += `<td>${window.CCTV.UI.escapeHtml(this.formatCameraDisplay(cam))}</td>`;
            } else {
                html += `<td>Камера #${group.id_cam}</td>`;
            }

            html += `<td>${window.CCTV.UI.escapeHtml(conditionDisplay)}</td>`;
            html += `<td>${window.CCTV.UI.escapeHtml(breakdownDisplay)}</td>`;
            html += `<td>${window.CCTV.UI.escapeHtml(dateDisplay)}</td>`;
            html += `<td>
                <button class="group-comment-btn" data-group="${groupId}" style="background: #3498db; color: white; border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 13px;">
                    📝
                </button>
            </td>`;

            html += '</tr>';
        }

        html += '</tbody></table>';
        document.getElementById('table-content').innerHTML = html;

        document.querySelectorAll('.group-comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const groupKey = btn.dataset.group;
                const [id_cam, recording_date] = groupKey.split('|');
                const group = groupList.find(g => g.id_cam == id_cam && g.recording_date === recording_date);
                if (group) {
                    this._showGroupDetailsPopup(group, e);
                }
            });
        });
    }

    _showGroupDetailsPopup(group, event) {
        this._closePopup();

        const popup = document.createElement('div');
        popup.className = 'details-popup';
        popup.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            padding: 15px;
            z-index: 10000;
            max-width: 800px;
            max-height: 500px;
            overflow-y: auto;
            min-width: 600px;
        `;

        const btnRect = event.target.getBoundingClientRect();
        let left = btnRect.left;
        let top = btnRect.bottom + 5;
        if (left + 600 > window.innerWidth) left = window.innerWidth - 600 - 10;
        if (top + 400 > window.innerHeight) top = btnRect.top - 400 - 5;
        if (top < 10) top = 10;
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';

        const cam = window.CCTV.AppState.camerasCache[group.id_cam];
        const camDisplay = cam ? this.formatCameraDisplay(cam) : `Камера #${group.id_cam}`;
        const dateDisplay = window.CCTV.UI.formatDateToDMY(group.recording_date);

        const canEdit = window.CCTV.UI.canEditCurrentTable();

        let detailsHtml = `
            <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                ${window.CCTV.UI.escapeHtml(camDisplay)} — ${window.CCTV.UI.escapeHtml(dateDisplay)}
            </div>
            <div style="margin-bottom: 10px; font-size: 13px; color: #555;">
                Всего записей в группе: ${group.records.length}
            </div>
            <table style="width:100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;">
                <colgroup>
                    <col style="width: 15%;">
                    <col style="width: 25%;">
                    <col style="width: 45%;">
                    ${canEdit ? '<col style="width: 15%;">' : ''}
                </colgroup>
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 4px 6px; text-align: left;">Состояние</th>
                        <th style="padding: 4px 6px; text-align: left;">Поломка</th>
                        <th style="padding: 4px 6px; text-align: left;">Комментарий</th>
                        ${canEdit ? '<th style="padding: 4px 6px; text-align: center;">Действия</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;

        group.records.forEach(rec => {
            detailsHtml += `
                <tr>
                    <td style="padding: 4px 6px;">${window.CCTV.UI.escapeHtml(rec.condition || '')}</td>
                    <td style="padding: 4px 6px;">${window.CCTV.UI.escapeHtml(rec.breakdown || '')}</td>
                    <td style="padding: 4px 6px; word-wrap: break-word; white-space: normal; max-width: 100%;">${window.CCTV.UI.escapeHtml(rec.comment || '')}</td>
                    ${canEdit ? `
                        <td style="padding: 4px 6px; text-align: center;">
                            <button class="popup-edit-btn" data-id="${rec.id}" style="background: #3498db; color: white; border: none; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-size: 12px; margin-right: 4px;">✎</button>
                            <button class="popup-delete-btn" data-id="${rec.id}" style="background: #e74c3c; color: white; border: none; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-size: 12px;">✕</button>
                        </td>
                    ` : ''}
                </tr>
            `;
        });

        detailsHtml += `
                </tbody>
            </table>
            <div style="margin-top: 10px; text-align: right;">
                <button class="popup-close-btn" style="background: #95a5a6; color: white; border: none; border-radius: 4px; padding: 5px 15px; cursor: pointer;">Закрыть</button>
            </div>
        `;

        popup.innerHTML = detailsHtml;
        document.body.appendChild(popup);
        this.popup = popup;

        popup.querySelectorAll('.popup-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this._closePopup();
                if (typeof this.showEditForm === 'function') {
                    this.showEditForm(id);
                }
            });
        });

        popup.querySelectorAll('.popup-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm('Вы уверены, что хотите удалить эту запись?')) {
                    this._closePopup();
                    this.deleteRecord(id);
                }
            });
        });

        popup.querySelector('.popup-close-btn').addEventListener('click', () => {
            this._closePopup();
        });

        setTimeout(() => {
            document.addEventListener('click', this._closePopupOnOutsideClick = (e) => {
                if (popup && !popup.contains(e.target)) {
                    this._closePopup();
                }
            });
        }, 0);
    }

    _closePopup() {
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
        }
        if (this._closePopupOnOutsideClick) {
            document.removeEventListener('click', this._closePopupOnOutsideClick);
            this._closePopupOnOutsideClick = null;
        }
    }

    // ==================== ФИЛЬТРЫ UI ====================
    buildFiltersUI() {
        const container = document.getElementById('filter-buttons-container');
        if (!container) return;
        const today = window.CCTV.UI.getTodayDate();
        if (!this.reportFilters.startDate) this.reportFilters.startDate = today;
        if (!this.reportFilters.endDate) this.reportFilters.endDate = today;
        
        const allAPs = window.CCTV.UI.getUniqueAPsFromCache();
        const allConditions = window.CCTV.Constants.CONDITION_OPTIONS;
        
        let html = `
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <div style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
                    <div class="filter-item">
                        <span class="filter-label">📅 Период</span>
                        <input type="date" id="report-start-date" class="date-input-mini" value="${this.reportFilters.startDate}" max="${today}">
                        <span>—</span>
                        <input type="date" id="report-end-date" class="date-input-mini" value="${this.reportFilters.endDate}" max="${today}">
                    </div>
                    <div class="filter-item" style="display: flex; gap: 8px; align-items: center;">
                        <span class="filter-label">АП:</span>
                        <div id="ap-buttons-container" style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 100px; overflow-y: auto; align-content: flex-start; border: 1px solid #e0e0e0; border-radius: 4px; padding: 4px; background: #fafafa;"></div>
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
                    <div class="filter-item" style="display: flex; gap: 8px; align-items: center;">
                        <span class="filter-label">Регистраторы:</span>
                        <div id="registrator-buttons-container" style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 120px; overflow-y: auto; align-content: flex-start; border: 1px solid #e0e0e0; border-radius: 4px; padding: 4px; background: #fafafa;"></div>
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
                    <div class="filter-item" style="display: flex; gap: 8px; align-items: center;">
                        <span class="filter-label">Состояние:</span>
                        <div id="condition-buttons-container" style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 100px; overflow-y: auto; align-content: flex-start; border: 1px solid #e0e0e0; border-radius: 4px; padding: 4px; background: #fafafa;"></div>
                    </div>
                </div>
            </div>
            <button class="reset-filters-icon" onclick="window.resetAllFilters()" title="Сбросить все фильтры" style="margin-top: 8px;">↻</button>
        `;
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.background = 'white';
        container.style.padding = '12px 15px';
        container.style.borderRadius = '8px';
        container.style.marginBottom = '20px';
        container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        
        const apContainer = document.getElementById('ap-buttons-container');
        const allApBtn = document.createElement('button');
        allApBtn.className = `filter-btn ${this.reportFilters.apFilters.size === 0 ? 'all-active' : ''}`;
        allApBtn.textContent = 'Все АП';
        allApBtn.onclick = () => {
            this.reportFilters.apFilters.clear();
            this.reportFilters.registratorFilters.clear();
            this.updateRegistratorButtonsByAp();
            this.updateConditionButtons();
            window.CCTV.loadTable(this.tableName);
            window.CCTV.AppState.saveState();
        };
        apContainer.appendChild(allApBtn);
        
        // === ТОЛЬКО ОДИН АП ИЛИ ВСЕ ===
        allAPs.forEach(ap => {
            const btn = document.createElement('button');
            const isActive = this.reportFilters.apFilters.has(ap);
            btn.className = `filter-btn ${isActive ? 'active' : ''}`;
            btn.textContent = `АП${ap}`;
            btn.onclick = () => {
                if (this.reportFilters.apFilters.has(ap)) {
                    this.reportFilters.apFilters.clear();
                } else {
                    this.reportFilters.apFilters.clear();
                    this.reportFilters.apFilters.add(ap);
                }
                this.reportFilters.registratorFilters.clear();
                this.updateRegistratorButtonsByAp();
                this.updateConditionButtons();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.AppState.saveState();
            };
            apContainer.appendChild(btn);
        });
        
        const regContainer = document.getElementById('registrator-buttons-container');
        this.regContainer = regContainer;
        this.updateRegistratorButtonsByAp();
        
        const condContainer = document.getElementById('condition-buttons-container');
        allConditions.forEach(condition => {
            const btn = document.createElement('button');
            const isActive = (condition === 'На текущий момент') 
                ? this.showLatestOnly 
                : this.reportFilters.conditionFilters.has(condition);
            btn.className = `filter-btn ${isActive ? 'active' : ''}`;
            btn.textContent = condition;
            btn.onclick = () => {
                if (condition === 'На текущий момент') {
                    this.showLatestOnly = !this.showLatestOnly;
                    if (this.showLatestOnly) {
                        this.reportFilters.registratorFilters.clear();
                        this.reportFilters.conditionFilters.clear();
                        const today = window.CCTV.UI.getTodayDate();
                        this.reportFilters.startDate = today;
                        this.reportFilters.endDate = today;
                        const startInput = document.getElementById('report-start-date');
                        const endInput = document.getElementById('report-end-date');
                        if (startInput) startInput.value = today;
                        if (endInput) endInput.value = today;
                    }
                    this.buildFiltersUI();
                    window.CCTV.loadTable(this.tableName);
                    window.CCTV.AppState.saveState();
                    return;
                }
                if (this.reportFilters.conditionFilters.has(condition)) {
                    this.reportFilters.conditionFilters.delete(condition);
                } else {
                    this.reportFilters.conditionFilters.add(condition);
                }
                this.showLatestOnly = false;
                this.updateConditionButtons();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.AppState.saveState();
            };
            condContainer.appendChild(btn);
        });
        
        const startDateInput = document.getElementById('report-start-date');
        const endDateInput = document.getElementById('report-end-date');
        if (startDateInput && endDateInput) {
            const dateHandler = () => {
                this.reportFilters.startDate = startDateInput.value;
                this.reportFilters.endDate = endDateInput.value;
                this.showLatestOnly = false;
                window.CCTV.loadTable(this.tableName);
                window.CCTV.AppState.saveState();
            };
            startDateInput.addEventListener('change', dateHandler);
            endDateInput.addEventListener('change', dateHandler);
        }
    }

    updateRegistratorButtonsByAp() {
        if (!this.regContainer) return;
        let allRegs = Object.entries(window.CCTV.AppState.registratorsCache).map(([id, name]) => ({
            id: parseInt(id), name: name, ap: parseInt(name.match(/АП(\d+)_/)?.[1] || 0)
        }));
        let visibleRegs = allRegs;
        if (this.reportFilters.apFilters.size > 0) {
            visibleRegs = allRegs.filter(r => this.reportFilters.apFilters.has(r.ap));
        }
        visibleRegs.sort((a,b) => a.name.localeCompare(b.name));
        
        this.regContainer.innerHTML = '';
        const allRegBtn = document.createElement('button');
        allRegBtn.className = `filter-btn ${this.reportFilters.registratorFilters.size === 0 ? 'all-active' : ''}`;
        allRegBtn.textContent = 'Все регистраторы';
        allRegBtn.onclick = () => {
            this.reportFilters.registratorFilters.clear();
            this.updateRegistratorButtonsByAp();
            window.CCTV.loadTable(this.tableName);
            window.CCTV.AppState.saveState();
        };
        this.regContainer.appendChild(allRegBtn);
        
        const disabled = (this.reportFilters.apFilters.size === 0);
        visibleRegs.forEach(reg => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${this.reportFilters.registratorFilters.has(reg.id) ? 'active' : ''}`;
            btn.textContent = reg.name;
            if (disabled) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.onclick = () => {
                    if (this.reportFilters.registratorFilters.has(reg.id)) {
                        this.reportFilters.registratorFilters.delete(reg.id);
                    } else {
                        this.reportFilters.registratorFilters.add(reg.id);
                    }
                    this.updateRegistratorButtonsByAp();
                    window.CCTV.loadTable(this.tableName);
                    window.CCTV.AppState.saveState();
                };
            }
            this.regContainer.appendChild(btn);
        });
    }

    updateConditionButtons() {
        const condContainer = document.getElementById('condition-buttons-container');
        if (!condContainer) return;
        const buttons = condContainer.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            const condition = btn.textContent;
            if (condition === 'На текущий момент') {
                btn.classList.toggle('active', this.showLatestOnly);
            } else {
                btn.classList.toggle('active', this.reportFilters.conditionFilters.has(condition));
            }
        });
    }

    // ==================== ДОБАВЛЕНИЕ ====================
    showAddForm() {
        if (!window.CCTV.UI.canEditCurrentTable()) {
            window.CCTV.UI.showMessage('У вас нет прав на добавление записей', 'error');
            return;
        }
        document.getElementById('modal-title').textContent = 'Добавление записи';
        this.buildAddFormFields();
    }

    buildAddFormFields() {
        const registrators = Object.entries(window.CCTV.AppState.registratorsCache).map(([id, name]) => ({
            id: parseInt(id),
            name: name,
            ap: parseInt(name.match(/АП(\d+)_/)?.[1] || 0)
        }));

        let selectedRegId = null;
        let selectedAp = null;

        if (this.reportFilters.registratorFilters.size === 1) {
            selectedRegId = Array.from(this.reportFilters.registratorFilters)[0];
        } else if (this.reportFilters.apFilters.size === 1) {
            selectedAp = Array.from(this.reportFilters.apFilters)[0];
            const found = registrators.find(r => r.ap === selectedAp);
            if (found) selectedRegId = found.id;
        } else if (this.lastSelectedRegistratorId !== null) {
            const exists = registrators.some(r => r.id === this.lastSelectedRegistratorId);
            if (exists) selectedRegId = this.lastSelectedRegistratorId;
        }

        const conditionOptions = window.CCTV.Constants.CONDITION_OPTIONS_FOR_FORMS;

        let fieldsHtml = `
            <label>Регистратор:</label>
            <select id="registrator-select" onchange="window.CCTV.CameraReportTable.updateCamerasByRegistrator()" style="width: 100%; padding: 8px; margin: 5px 0;">
                <option value="">Выберите регистратор</option>
                ${registrators.map(reg => 
                    `<option value="${reg.id}" ${reg.id === selectedRegId ? 'selected' : ''}>${window.CCTV.UI.escapeHtml(reg.name)}</option>`
                ).join('')}
            </select>
            <label>Камера:</label>
            <select id="camera-select" name="id_cam" required style="width: 100%; padding: 8px; margin: 5px 0;" onchange="window.CCTV.CameraReportTable.onCameraSelect()">
                <option value="">Сначала выберите регистратор</option>
            </select>
            <div id="last-report-info" style="display: none; margin: 10px 0;"></div>
            <label>Состояние:</label>
            <select id="condition-select" name="condition" required style="width: 100%; padding: 8px; margin: 5px 0;">
                ${conditionOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>
            <label>Примечание:</label>
            <textarea name="comment" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;"></textarea>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
                <div class="checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="hide-today-cameras" checked onchange="window.CCTV.CameraReportTable.updateCamerasByRegistrator()">
                        <span class="checkbox-text">Не показывать камеры, уже добавленные сегодня</span>
                    </label>
                </div>
            </div>
        `;
        document.getElementById('modal-fields').innerHTML = fieldsHtml;
        document.getElementById('modal').style.display = 'flex';

        if (selectedRegId !== null) {
            this.lastSelectedRegistratorId = selectedRegId;
            this.updateCamerasByRegistrator().then(() => {
                this.onCameraSelect();
            });
        } else {
            const cameraSelect = document.getElementById('camera-select');
            if (cameraSelect) cameraSelect.innerHTML = '<option value="">Сначала выберите регистратор</option>';
        }

        const regSelect = document.getElementById('registrator-select');
        if (regSelect) {
            regSelect.addEventListener('change', () => {
                this.lastSelectedRegistratorId = regSelect.value ? parseInt(regSelect.value) : null;
            });
        }

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
                        <strong>Последняя запись:</strong><br>
                        ${date} | ${lastReport.condition}${breakdownText}<br>
                        ${window.CCTV.UI.escapeHtml(lastReport.comment || 'без комментария')}
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

    async addReportRecord() {
        const idCam = document.getElementById('camera-select').value;
        const condition = document.getElementById('condition-select').value;
        const comment = document.querySelector('textarea[name="comment"]').value;
        if (!idCam || !condition) {
            window.CCTV.UI.showMessage('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }
        const currentDate = window.CCTV.UI.getTodayDate();
        try {
            const result = await window.CCTV.API.createData(this.tableName, {
                id_cam: idCam,
                condition: condition,
                breakdown: '',
                comment: comment,
                recording_date: currentDate
            });
            if (result.success) {
                window.CCTV.UI.closeModal();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.showMessage('Запись успешно добавлена', 'success');
            } else {
                window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            window.CCTV.UI.showMessage('Ошибка при добавлении', 'error');
        }
    }

    // ==================== РЕДАКТИРОВАНИЕ ====================
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
            
            const conditionOptions = window.CCTV.Constants.CONDITION_OPTIONS_FOR_FORMS;

            if (isAdmin) {
                const cam = window.CCTV.AppState.camerasCache[record.id_cam];
                const currentRegId = cam ? cam.idreg : null;
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
                    <select id="condition-select-edit" name="condition" required style="width: 100%; padding: 8px; margin: 5px 0;">
                        ${conditionOptions.map(opt => 
                            `<option value="${opt}" ${record.condition === opt ? 'selected' : ''}>${opt}</option>`
                        ).join('')}
                    </select>
                    <label>Примечание:</label>
                    <textarea name="comment" rows="3" style="width: 100%; padding: 8px; margin: 5px 0;">${window.CCTV.UI.escapeHtml(record.comment || '')}</textarea>
                    <input type="hidden" name="id" value="${id}">
                `;
                document.getElementById('modal-fields').innerHTML = fieldsHtml;
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

    async updateReportRecordFull(id) {
        const idCam = document.getElementById('camera-select-edit').value;
        const condition = document.getElementById('condition-select-edit').value;
        const comment = document.querySelector('textarea[name="comment"]').value;
        if (!idCam || !condition) {
            window.CCTV.UI.showMessage('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }
        const currentDate = window.CCTV.UI.getTodayDate();
        try {
            await window.CCTV.API.deleteData(this.tableName, id);
            const result = await window.CCTV.API.createData(this.tableName, {
                id_cam: idCam,
                condition: condition,
                breakdown: '',
                comment: comment,
                recording_date: currentDate
            });
            if (result.success) {
                window.CCTV.UI.closeModal();
                window.CCTV.loadTable(this.tableName);
                window.CCTV.UI.showMessage('Запись успешно обновлена', 'success');
            } else {
                window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
            }
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
                window.CCTV.UI.showMessage('Запись была изменена другим пользователем. Обновите страницу.', 'error');
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

    async deleteRecord(id) {
        if (!window.CCTV.UI.canEditCurrentTable()) {
            window.CCTV.UI.showMessage('У вас нет прав на удаление', 'error');
            return;
        }
        const result = await window.CCTV.API.deleteData(this.tableName, id);
        if (result.success) {
            window.CCTV.loadTable(this.tableName);
            window.CCTV.UI.showMessage('Запись успешно удалена', 'success');
        } else {
            window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
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
            window.CCTV.UI.showMessage(`Экспортировано ${exportData.length} записей`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            window.CCTV.UI.showMessage('Ошибка при экспорте', 'error');
        }
    }
}

window.CCTV.CameraReportTable = new CameraReportTable();