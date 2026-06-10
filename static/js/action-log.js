/**
 * action-log.js - Таблица журнала действий
 */

class ActionLogTable extends window.CCTV.BaseTable {
    constructor() {
        super('cam_action_log');
        this.actionLogFilters = window.CCTV.AppState.actionLogFilters;
    }
    
    async loadData() {
        const response = await fetch(`/api/data/${this.tableName}`);
        const data = await response.json();
        this.originalData = data.data;
        return this.originalData;
    }
    
    applyActionLogFilters(data) {
        let filtered = [...data];
        if (this.actionLogFilters.startDate) {
            const start = new Date(this.actionLogFilters.startDate);
            filtered = filtered.filter(row => {
                if (!row.action_date) return false;
                const [day, month, year] = row.action_date.split('.');
                const rowDate = new Date(`${year}-${month}-${day}`);
                return rowDate >= start;
            });
        }
        if (this.actionLogFilters.endDate) {
            const end = new Date(this.actionLogFilters.endDate);
            filtered = filtered.filter(row => {
                if (!row.action_date) return false;
                const [day, month, year] = row.action_date.split('.');
                const rowDate = new Date(`${year}-${month}-${day}`);
                return rowDate <= end;
            });
        }
        if (this.actionLogFilters.userFilter) {
            filtered = filtered.filter(row => row.user === this.actionLogFilters.userFilter);
        }
        if (this.actionLogFilters.actionFilter) {
            filtered = filtered.filter(row => row.action === this.actionLogFilters.actionFilter);
        }
        if (this.actionLogFilters.tableFilter) {
            filtered = filtered.filter(row => row.table_name === this.actionLogFilters.tableFilter);
        }
        return filtered;
    }
    
    render() {
        let workingData = [...this.originalData];
        workingData = this.applyActionLogFilters(workingData);
        let filteredData = this.applyFilters(workingData);
        let sortedData = this.applySorting(filteredData);
        if (sortedData.length === 0) {
            document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center;">Нет данных</p>';
            return;
        }
        const columnsToDisplay = window.CCTV.Constants.COLUMN_ORDER['cam_action_log'];
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
                if (col === 'action' && row.action) {
                    let details = [];
                    if (row.table_name) details.push(`Таблица: ${row.table_name}`);
                    if (row.record_id) details.push(`ID записи: ${row.record_id}`);
                    if (row.field_name) details.push(`Поле: ${row.field_name}`);
                    if (row.old_value && row.old_value !== '') details.push(`Было: ${row.old_value}`);
                    if (row.new_value && row.new_value !== '') details.push(`Стало: ${row.new_value}`);
                    if (details.length) {
                        value = `${row.action} (${details.join(', ')})`;
                    }
                }
                html += `<td>${window.CCTV.UI.escapeHtml(value)}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></tr>';
        document.getElementById('table-content').innerHTML = html;
    }
    
    buildFiltersUI() {
        const container = document.getElementById('filter-buttons-container');
        if (!container) return;
        
        // Полный сброс стилей, чтобы не наследовать высоту от других таблиц
        container.style.cssText = '';
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'space-between';
        container.style.background = 'white';
        container.style.padding = '8px 12px';
        container.style.borderRadius = '8px';
        container.style.marginBottom = '20px';
        container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        container.style.gap = '8px';
        
        const today = window.CCTV.UI.getTodayDate();
        if (!this.actionLogFilters.startDate) this.actionLogFilters.startDate = today;
        if (!this.actionLogFilters.endDate) this.actionLogFilters.endDate = today;
        
        const users = [...new Set(this.originalData.map(row => row.user).filter(v => v))];
        const actions = [...new Set(this.originalData.map(row => row.action).filter(v => v))];
        const tables = [...new Set(this.originalData.map(row => row.table_name).filter(v => v))];
        
        let html = `
            <div class="filter-row" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                <div class="filter-item" style="display: inline-flex; align-items: center; gap: 5px; background: #f8f9fa; padding: 4px 10px; border-radius: 20px;">
                    <span class="filter-label">📅</span>
                    <input type="date" id="action-start-date" class="date-input-mini" value="${this.actionLogFilters.startDate}" max="${today}" style="width: 110px; padding: 4px 6px;">
                    <span>—</span>
                    <input type="date" id="action-end-date" class="date-input-mini" value="${this.actionLogFilters.endDate}" max="${today}" style="width: 110px; padding: 4px 6px;">
                </div>
                <div class="filter-item" style="display: inline-flex; align-items: center; gap: 5px; background: #f8f9fa; padding: 4px 10px; border-radius: 20px;">
                    <span class="filter-label">Пользователь</span>
                    <select id="action-user-filter" class="filter-select-mini" style="width: auto; min-width: 100px; padding: 4px 6px;">
                        <option value="">Все</option>
                        ${users.map(u => `<option value="${window.CCTV.UI.escapeHtml(u)}" ${this.actionLogFilters.userFilter === u ? 'selected' : ''}>${window.CCTV.UI.escapeHtml(u)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-item" style="display: inline-flex; align-items: center; gap: 5px; background: #f8f9fa; padding: 4px 10px; border-radius: 20px;">
                    <span class="filter-label">Действие</span>
                    <select id="action-action-filter" class="filter-select-mini" style="width: auto; min-width: 120px; padding: 4px 6px;">
                        <option value="">Все</option>
                        ${actions.map(a => `<option value="${window.CCTV.UI.escapeHtml(a)}" ${this.actionLogFilters.actionFilter === a ? 'selected' : ''}>${window.CCTV.UI.escapeHtml(a)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-item" style="display: inline-flex; align-items: center; gap: 5px; background: #f8f9fa; padding: 4px 10px; border-radius: 20px;">
                    <span class="filter-label">Таблица</span>
                    <select id="action-table-filter" class="filter-select-mini" style="width: auto; min-width: 120px; padding: 4px 6px;">
                        <option value="">Все</option>
                        ${tables.map(t => `<option value="${window.CCTV.UI.escapeHtml(t)}" ${this.actionLogFilters.tableFilter === t ? 'selected' : ''}>${window.CCTV.UI.escapeHtml(t)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <button class="reset-filters-icon" onclick="window.resetAllFilters()" title="Сбросить все фильтры" style="flex-shrink: 0;">↻</button>
        `;
        container.innerHTML = html;
        
        // Обработчики событий
        const startDateInput = document.getElementById('action-start-date');
        const endDateInput = document.getElementById('action-end-date');
        const userSelect = document.getElementById('action-user-filter');
        const actionSelect = document.getElementById('action-action-filter');
        const tableSelect = document.getElementById('action-table-filter');
        
        if (startDateInput && endDateInput) {
            const dateHandler = () => {
                this.actionLogFilters.startDate = startDateInput.value;
                this.actionLogFilters.endDate = endDateInput.value;
                window.CCTV.loadTable(this.tableName);
                window.CCTV.AppState.saveState();
            };
            startDateInput.addEventListener('change', dateHandler);
            endDateInput.addEventListener('change', dateHandler);
        }
        
        if (userSelect) {
            userSelect.addEventListener('change', () => {
                this.actionLogFilters.userFilter = userSelect.value;
                window.CCTV.loadTable(this.tableName);
                window.CCTV.AppState.saveState();
            });
        }
        
        if (actionSelect) {
            actionSelect.addEventListener('change', () => {
                this.actionLogFilters.actionFilter = actionSelect.value;
                window.CCTV.loadTable(this.tableName);
                window.CCTV.AppState.saveState();
            });
        }
        
        if (tableSelect) {
            tableSelect.addEventListener('change', () => {
                this.actionLogFilters.tableFilter = tableSelect.value;
                window.CCTV.loadTable(this.tableName);
                window.CCTV.AppState.saveState();
            });
        }
    }
    
    async exportToExcel() {
        let workingData = [...this.originalData];
        workingData = this.applyActionLogFilters(workingData);
        let filteredData = this.applyFilters(workingData);
        let sortedData = this.applySorting(filteredData);
        if (sortedData.length === 0) {
            window.CCTV.UI.showMessage('Нет данных для экспорта', 'error');
            return;
        }
        const exportData = sortedData.map(row => ({
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
        try {
            const response = await fetch('/export_action_log_excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(exportData)
            });
            if (!response.ok) {
                window.CCTV.UI.showMessage(`Ошибка экспорта (${response.status})`, 'error');
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `action_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
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
    
    showAddForm() {
        window.CCTV.UI.showMessage('Журнал действий доступен только для просмотра', 'error');
    }
    
    showEditForm(id) {
        window.CCTV.UI.showMessage('Журнал действий доступен только для просмотра', 'error');
    }
    
    async deleteRecord(id) {
        window.CCTV.UI.showMessage('Журнал действий нельзя удалять', 'error');
    }
}

window.CCTV.ActionLogTable = new ActionLogTable();