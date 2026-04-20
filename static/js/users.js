/**
 * users.js - Таблица пользователей (доступна только админам)
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
            html += '<tr>';
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
        const labels = {
            username: 'Логин',
            password: 'Пароль',
            role: 'Роль'
        };
        let fieldsHtml = `
            <label>${labels.username} *:</label>
            <input type="text" name="username" required style="width: 100%; padding: 8px; margin: 5px 0;">
            <label>${labels.password} *:</label>
            <input type="password" name="password" required style="width: 100%; padding: 8px; margin: 5px 0;">
            <small style="color: #666; display: block; margin-top: -3px; margin-bottom: 10px;">Пароль будет зашифрован</small>
            <label>${labels.role} *:</label>
            <select name="role" required style="width: 100%; padding: 8px; margin: 5px 0;">
                <option value="">Выберите роль</option>
                <option value="admin">Администратор</option>
                <option value="editor">Редактор</option>
                <option value="user">Пользователь</option>
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
        
        if (!data.username || !data.password || !data.role) {
            window.CCTV.UI.showMessage('Заполните все обязательные поля', 'error');
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
        document.getElementById('modal-title').textContent = 'Редактирование пользователя';
        
        const labels = {
            username: 'Логин',
            password: 'Пароль',
            role: 'Роль'
        };
        
        let fieldsHtml = '';
        for (let key in data) {
            if (key === 'id' || key === 'version') continue;
            let value = data[key] || '';
            const label = labels[key] || key;
            if (key === 'password') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <input type="password" name="${key}" value="" placeholder="Введите новый пароль" style="width: 100%; padding: 8px; margin: 5px 0;">
                    <small style="color: #666; display: block; margin-top: -3px; margin-bottom: 10px;">Оставьте пустым, чтобы не менять пароль</small>
                `;
            } else if (key === 'role') {
                fieldsHtml += `
                    <label>${window.CCTV.UI.escapeHtml(label)}:</label>
                    <select name="${key}" style="width: 100%; padding: 8px; margin: 5px 0;">
                        <option value="admin" ${value === 'admin' ? 'selected' : ''}>Администратор</option>
                        <option value="editor" ${value === 'editor' ? 'selected' : ''}>Редактор</option>
                        <option value="user" ${value === 'user' ? 'selected' : ''}>Пользователь</option>
                    </select>
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
            if (submitData.password === '') {
                delete submitData.password;
            }
            submitData.version = this.currentEditVersion;
            
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