/**
 * users.js - Таблица пользователей
 * Доступна только администраторам
 */

class UsersTable extends window.CCTV.BaseTable {
    constructor() {
        super('cam_users');
    }
    
    render() {
        let workingData = [...this.originalData];
        let filteredData = this.applyFilters(workingData);
        let sortedData = this.applySorting(filteredData);
        
        if (sortedData.length === 0) {
            document.getElementById('table-content').innerHTML = '<p style="padding: 20px; text-align: center;">Нет данных</p>';
            return;
        }
        
        const columnsToDisplay = ['username', 'password', 'role'];
        
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
        html += '</tr></thead><tbody>';
        
        for (const row of sortedData) {
            html += '<tr data-id="' + row.id + '">';
            
            html += `<td>${window.CCTV.UI.escapeHtml(row.username || '')}</td>`;
            html += '<td>••••••</td>';
            
            let roleDisplay = row.role || '';
            if (roleDisplay === 'admin') roleDisplay = 'Администратор';
            else if (roleDisplay === 'editor') roleDisplay = 'Редактор';
            else if (roleDisplay === 'user') roleDisplay = 'Пользователь';
            html += `<td>${window.CCTV.UI.escapeHtml(roleDisplay)}</td>`;
            
            html += '</tr>';
        }
        
        html += '</tbody></table>';
        
        document.getElementById('table-content').innerHTML = html;
    }
    
    showAddForm() {
        if (!window.CCTV.UI.canEditCurrentTable()) {
            window.CCTV.UI.showMessage('У вас нет прав на добавление записей', 'error');
            return;
        }
        
        document.getElementById('modal-title').textContent = 'Добавление пользователя';
        this.buildAddFormFields();
    }
    
    buildAddFormFields() {
        fetch(`/api/structure/${this.tableName}`)
            .then(response => response.json())
            .then(data => {
                let fieldsHtml = '';
                
                data.columns.forEach(col => {
                    const cleanCol = col.replace(' (NOT NULL)', '');
                    if (cleanCol === 'id') return;
                    
                    const displayName = window.CCTV.Constants.COLUMN_NAMES[cleanCol] || cleanCol;
                    const isRequired = col.includes('NOT NULL');
                    
                    if (cleanCol === 'password') {
                        fieldsHtml += `
                            <label>${window.CCTV.UI.escapeHtml(displayName)}${isRequired ? ' *' : ''}:</label>
                            <input type="password" name="${cleanCol}" ${isRequired ? 'required' : ''} style="width: 100%; padding: 8px; margin: 5px 0;">
                            <small style="color: #666; display: block; margin-top: -3px; margin-bottom: 10px;">Пароль будет зашифрован</small>
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

        // Запрашиваем блокировку
        const locked = await this.acquireLock(id);
        if (!locked) return;

        const data = await window.CCTV.API.fetchData(this.tableName, id);
        document.getElementById('modal-title').textContent = 'Редактирование пользователя';
        
        let fieldsHtml = '';
        
        for (let key in data) {
            if (key === 'id') continue;
            const displayName = window.CCTV.Constants.COLUMN_NAMES[key] || key;
            let inputValue = data[key] || '';
            
            if (key === 'password') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(displayName)}:</label>
                    <input type="password" name="${key}" value="" placeholder="Введите новый пароль" style="width: 100%; padding: 8px; margin: 5px 0;">
                    <small style="color: #666; display: block; margin-top: -3px; margin-bottom: 10px;">Оставьте пустым, чтобы не менять пароль</small>
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
            
            if (submitData.password === '') {
                delete submitData.password;
            }
            
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
    
    async deleteRecord(id) {
        const currentUser = document.getElementById('user-info')?.dataset?.username;
        const record = await window.CCTV.API.fetchData(this.tableName, id);
        
        if (record.username === currentUser) {
            window.CCTV.UI.showMessage('Нельзя удалить свою учётную запись', 'error');
            return;
        }
        
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
        
        const result = await window.CCTV.API.deleteData(this.tableName, id);
        if (result.success) {
            window.CCTV.loadTable(this.tableName);
            window.CCTV.UI.showMessage('Запись успешно удалена', 'success');
        } else {
            window.CCTV.UI.showMessage('Ошибка: ' + result.error, 'error');
        }
    }
}

window.CCTV.UsersTable = new UsersTable();