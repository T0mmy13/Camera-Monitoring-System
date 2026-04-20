/**
 * table-base.js - Базовый класс для всех таблиц (оптимистическая блокировка через version)
 */

class BaseTable {
    constructor(tableName) {
        this.tableName = tableName;
        this.originalData = [];
        this.currentFilters = {};
        this.currentSort = { column: null, order: null };
        this.currentEditId = null;
        this.currentEditVersion = null;
    }
    
    async loadData() {
        try {
            const response = await fetch(`/api/data/${this.tableName}`);
            const data = await response.json();
            this.originalData = data.data;
            return this.originalData;
        } catch (error) {
            console.error('Error loading data:', error);
            window.CCTV.UI.showMessage('Ошибка загрузки данных', 'error');
            return [];
        }
    }
    
    getUniqueValuesForColumn(column) {
        if (this.tableName === 'cam_action_log' && column === 'time_action') {
            const dates = [...new Set(this.originalData.map(row => {
                if (row[column]) return row[column].split(' ')[0];
                return null;
            }).filter(v => v !== null))];
            return dates.sort().reverse();
        }
        if (this.tableName === 'cam_registrators' && column === 'registrator_full') {
            return [...new Set(this.originalData.map(row => row[column]))]
                .filter(v => v !== null && v !== '')
                .sort((a, b) => {
                    const parseReg = (str) => {
                        const match = str.match(/АП(\d+)_(\d+)/);
                        if (match) return { ap: parseInt(match[1]), id_reg: parseInt(match[2]) };
                        return { ap: 0, id_reg: 0 };
                    };
                    const parsedA = parseReg(a);
                    const parsedB = parseReg(b);
                    if (parsedA.ap !== parsedB.ap) return parsedA.ap - parsedB.ap;
                    return parsedA.id_reg - parsedB.id_reg;
                });
        }
        return [...new Set(this.originalData.map(row => row[column]))]
            .filter(v => v !== null && v !== '')
            .sort();
    }
    
    applyFilters(data) {
        return data.filter(row => {
            for (let [column, filterValue] of Object.entries(this.currentFilters)) {
                if (filterValue) {
                    let rowValue = row[column];
                    if (this.tableName === 'cam_action_log' && column === 'time_action' && rowValue) {
                        const rowDate = rowValue.split(' ')[0];
                        if (rowDate !== filterValue) return false;
                    } else if (rowValue != filterValue) {
                        return false;
                    }
                }
            }
            return true;
        });
    }
    
    applySorting(data) {
        if (!this.currentSort.column || !this.currentSort.order) return data;
        return [...data].sort((a, b) => {
            let valA = a[this.currentSort.column];
            let valB = b[this.currentSort.column];
            if (valA === null) valA = '';
            if (valB === null) valB = '';
            if (this.tableName === 'cam_registrators' && this.currentSort.column === 'registrator_full') {
                const parseReg = (str) => {
                    const match = str.match(/АП(\d+)_(\d+)/);
                    if (match) return { ap: parseInt(match[1]), id_reg: parseInt(match[2]) };
                    return { ap: 0, id_reg: 0 };
                };
                const parsedA = parseReg(valA);
                const parsedB = parseReg(valB);
                if (parsedA.ap !== parsedB.ap) {
                    return this.currentSort.order === 'asc' ? parsedA.ap - parsedB.ap : parsedB.ap - parsedA.ap;
                }
                return this.currentSort.order === 'asc' ? parsedA.id_reg - parsedB.id_reg : parsedB.id_reg - parsedA.id_reg;
            }
            if (this.tableName === 'cam_action_log' && this.currentSort.column === 'time_action') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
                return this.currentSort.order === 'asc' ? valA - valB : valB - valA;
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return this.currentSort.order === 'asc' ? valA - valB : valB - valA;
            }
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (valA < valB) return this.currentSort.order === 'asc' ? -1 : 1;
            if (valA > valB) return this.currentSort.order === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    showColumnMenu(event, column) {
        const noFilterColumns = window.CCTV.Constants.NO_FILTER_COLUMNS[this.tableName] || [];
        if (noFilterColumns.includes(column)) return;
        event.stopPropagation();
        const existingMenu = document.querySelector('.dropdown-menu');
        if (existingMenu) existingMenu.remove();
        const buttonRect = event.target.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';
        menu.style.left = buttonRect.left + 'px';
        menu.style.top = (buttonRect.bottom + window.scrollY) + 'px';
        let menuHtml = `<div class="dropdown-header">Фильтр по значению</div>
            <div class="dropdown-item" onclick="window.CCTV.setFilter('${column}', null)">
                Все значения ${!this.currentFilters[column] ? '✓' : ''}
            </div>`;
        const uniqueValues = this.getUniqueValuesForColumn(column);
        uniqueValues.forEach(value => {
            let filterValue = value;
            let displayValue = value;
            if (this.tableName === 'cam_action_log' && column === 'time_action') {
                displayValue = value;
                filterValue = value;
            }
            const isActive = this.currentFilters[column] === filterValue;
            const escapedValue = window.CCTV.UI.escapeHtml(filterValue.toString());
            menuHtml += `<div class="dropdown-item ${isActive ? 'active' : ''}" onclick="window.CCTV.setFilter('${column}', '${escapedValue.replace(/'/g, "\\'")}')">
                ${window.CCTV.UI.escapeHtml(displayValue)} ${isActive ? '✓' : ''}
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
    
    setFilter(column, value) {
        if (value === null) {
            delete this.currentFilters[column];
        } else {
            this.currentFilters[column] = value;
        }
        this.closeDropdownMenu();
        window.CCTV.loadTable(this.tableName);
        window.CCTV.AppState.saveState();
    }
    
    setSort(column, order) {
        if (this.currentSort.column === column && this.currentSort.order === order) {
            this.currentSort = { column: null, order: null };
        } else {
            this.currentSort = { column, order };
        }
        this.closeDropdownMenu();
        window.CCTV.loadTable(this.tableName);
        window.CCTV.AppState.saveState();
    }
    
    closeDropdownMenu() {
        const menu = document.querySelector('.dropdown-menu');
        if (menu) menu.remove();
    }
    
    render() {
        let workingData = [...this.originalData];
        let filteredData = this.applyFilters(workingData);
        let sortedData = this.applySorting(filteredData);
        if (sortedData.length === 0) {
            document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center;">Нет данных</p>';
            return;
        }
        let columnsToDisplay = window.CCTV.Constants.COLUMN_ORDER[this.tableName] || 
            Object.keys(sortedData[0] || {}).filter(col => !window.CCTV.Constants.HIDDEN_COLUMNS.includes(col));
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
                if (this.tableName === 'cam_users' && col === 'password') {
                    html += '<td>••••••</td>';
                    continue;
                }
                html += `<td>${window.CCTV.UI.escapeHtml(value)}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        const originalCount = this.originalData.length;
        const totalCount = sortedData.length;
        let countHtml = `<div style="padding: 10px 15px; background: #f8f9fa; border-top: 1px solid #ddd; border-radius: 0 0 8px 8px; font-size: 13px; color: #555;">
            📊 Показано записей: ${totalCount} из ${originalCount}
        </div>`;
        html += countHtml;
        document.getElementById('table-content').innerHTML = html;
    }
    
    showAddForm() {
        window.CCTV.UI.showMessage('Форма добавления не реализована для этой таблицы', 'error');
    }
    
    async showEditForm(id) {
        window.CCTV.UI.showMessage('Форма редактирования не реализована для этой таблицы', 'error');
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
}

window.CCTV = window.CCTV || {};
window.CCTV.BaseTable = BaseTable;