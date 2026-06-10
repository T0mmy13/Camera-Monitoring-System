/**
 * analytics.js - Модуль аналитики (с кнопочными фильтрами и прокруткой)
 */

class AnalyticsView {
    constructor() {
        this.container = null;
        this.filters = {
            date_from: this.getDefaultDateFrom(),
            date_to: this.getDefaultDateTo(),
            ap_ids: new Set(),
            registrator_ids: new Set()
        };
        this.data = null;
        this.charts = {};
        this.registrators = [];
        this.aps = [];
        this.allRegistrators = [];
    }
    
    getDefaultDateFrom() {
        let d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    }
    
    getDefaultDateTo() {
        return new Date().toISOString().split('T')[0];
    }
    
    async show() {
        if (!this.container) {
            this.createContainer();
        }
        this.container.style.display = 'block';
        await this.loadFiltersData();
        await this.loadAnalyticsData();
        this.render();
    }
    
    hide() {
        if (this.container) this.container.style.display = 'none';
        for (let key in this.charts) {
            if (this.charts[key]) this.charts[key].destroy();
        }
        this.charts = {};
    }
    
    createContainer() {
        const containerDiv = document.createElement('div');
        containerDiv.id = 'analytics-container';
        containerDiv.style.display = 'none';
        document.querySelector('.container').appendChild(containerDiv);
        this.container = containerDiv;
    }
    
    async loadFiltersData() {
        if (Object.keys(window.CCTV.AppState.registratorsCache).length === 0) {
            await window.CCTV.API.loadRegistratorsCache();
        }
        this.allRegistrators = Object.entries(window.CCTV.AppState.registratorsCache).map(([id, name]) => ({
            id: parseInt(id),
            name: name,
            ap: parseInt(name.match(/АП(\d+)_/)?.[1] || 0)
        }));
        this.aps = [...new Set(this.allRegistrators.map(r => r.ap))].sort((a,b)=>a-b);
        this.filters.ap_ids.clear();
        this.filters.registrator_ids.clear();
    }
    
    async loadAnalyticsData() {
        const params = new URLSearchParams();
        params.append('date_from', this.filters.date_from);
        params.append('date_to', this.filters.date_to);
        this.filters.ap_ids.forEach(id => params.append('ap_ids', id));
        this.filters.registrator_ids.forEach(id => params.append('registrator_ids', id));
        
        try {
            const response = await fetch(`/api/analytics?${params.toString()}`);
            if (!response.ok) {
                window.CCTV.UI.showMessage('Ошибка загрузки аналитики', 'error');
                return;
            }
            this.data = await response.json();
            if (this.data.error) {
                window.CCTV.UI.showMessage(this.data.error, 'error');
            }
        } catch(e) {
            console.error(e);
            window.CCTV.UI.showMessage('Ошибка соединения', 'error');
        }
    }
    
    render() {
        if (!this.data) return;
        this.container.innerHTML = '';
        this.renderFilters();
        this.renderKPI();
        this.renderStatusDistribution();
        this.renderDailyStatus();
        this.renderTopBreakdowns();
        this.renderProblemRegistrators();
        this.renderLongestBreakdowns();
    }
    
    renderFilters() {
        const filterDiv = document.createElement('div');
        filterDiv.className = 'analytics-filters';
        filterDiv.style.cssText = 'background: white; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        
        const dateRow = document.createElement('div');
        dateRow.style.display = 'flex';
        dateRow.style.flexWrap = 'wrap';
        dateRow.style.alignItems = 'center';
        dateRow.style.gap = '15px';
        dateRow.innerHTML = `
            <div class="filter-item">
                <span class="filter-label">📅 Период</span>
                <input type="date" id="analytics-date-from" class="date-input-mini" value="${this.filters.date_from}">
                <span>—</span>
                <input type="date" id="analytics-date-to" class="date-input-mini" value="${this.filters.date_to}">
            </div>
        `;
        
        // АП с прокруткой
        const apRow = document.createElement('div');
        apRow.style.display = 'flex';
        apRow.style.flexWrap = 'wrap';
        apRow.style.alignItems = 'center';
        apRow.style.gap = '8px';
        apRow.innerHTML = `<span class="filter-buttons-title">АП:</span>`;
        const apButtonsDiv = document.createElement('div');
        apButtonsDiv.style.display = 'flex';
        apButtonsDiv.style.flexWrap = 'wrap';
        apButtonsDiv.style.gap = '4px';
        apButtonsDiv.style.maxHeight = '100px';
        apButtonsDiv.style.overflowY = 'auto';
        apButtonsDiv.style.alignContent = 'flex-start';
        apButtonsDiv.style.border = '1px solid #e0e0e0';
        apButtonsDiv.style.borderRadius = '4px';
        apButtonsDiv.style.padding = '4px';
        apButtonsDiv.style.background = '#fafafa';
        apRow.appendChild(apButtonsDiv);
        
        const allApBtn = document.createElement('button');
        allApBtn.className = `filter-btn ${this.filters.ap_ids.size === 0 ? 'all-active' : ''}`;
        allApBtn.textContent = 'Все АП';
        allApBtn.onclick = () => {
            this.filters.ap_ids.clear();
            this.filters.registrator_ids.clear();
            this.updateRegistratorFilterButtons();
            this.applyFiltersAndReload();
        };
        apButtonsDiv.appendChild(allApBtn);
        
        this.aps.forEach(ap => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${this.filters.ap_ids.has(ap) ? 'active' : ''}`;
            btn.textContent = `АП${ap}`;
            btn.onclick = () => {
                if (this.filters.ap_ids.has(ap)) {
                    this.filters.ap_ids.delete(ap);
                } else {
                    this.filters.ap_ids.add(ap);
                }
                if (this.filters.ap_ids.size === this.aps.length) {
                    this.filters.ap_ids.clear();
                }
                this.filters.registrator_ids.clear();
                this.updateRegistratorFilterButtons();
                this.applyFiltersAndReload();
            };
            apButtonsDiv.appendChild(btn);
        });
        
        // Регистраторы с прокруткой
        const regRow = document.createElement('div');
        regRow.style.display = 'flex';
        regRow.style.flexWrap = 'wrap';
        regRow.style.alignItems = 'center';
        regRow.style.gap = '8px';
        regRow.innerHTML = `<span class="filter-buttons-title">Регистраторы:</span>`;
        const regButtonsDiv = document.createElement('div');
        regButtonsDiv.style.display = 'flex';
        regButtonsDiv.style.flexWrap = 'wrap';
        regButtonsDiv.style.gap = '4px';
        regButtonsDiv.style.maxHeight = '120px';
        regButtonsDiv.style.overflowY = 'auto';
        regButtonsDiv.style.alignContent = 'flex-start';
        regButtonsDiv.style.border = '1px solid #e0e0e0';
        regButtonsDiv.style.borderRadius = '4px';
        regButtonsDiv.style.padding = '4px';
        regButtonsDiv.style.background = '#fafafa';
        regRow.appendChild(regButtonsDiv);
        this.regRow = regButtonsDiv;
        
        filterDiv.appendChild(dateRow);
        filterDiv.appendChild(apRow);
        filterDiv.appendChild(regRow);
        
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-filters-icon';
        resetBtn.innerHTML = '↻';
        resetBtn.title = 'Сбросить все фильтры';
        resetBtn.onclick = () => {
            this.filters.ap_ids.clear();
            this.filters.registrator_ids.clear();
            this.updateRegistratorFilterButtons();
            this.applyFiltersAndReload();
        };
        filterDiv.appendChild(resetBtn);
        
        this.container.appendChild(filterDiv);
        
        const dateFromInput = document.getElementById('analytics-date-from');
        const dateToInput = document.getElementById('analytics-date-to');
        if (dateFromInput && dateToInput) {
            const dateHandler = () => {
                this.filters.date_from = dateFromInput.value;
                this.filters.date_to = dateToInput.value;
                this.applyFiltersAndReload();
            };
            dateFromInput.addEventListener('change', dateHandler);
            dateToInput.addEventListener('change', dateHandler);
        }
        
        this.updateRegistratorFilterButtons();
    }
    
    updateRegistratorFilterButtons() {
        if (!this.regRow) return;
        let visibleRegs = this.allRegistrators;
        if (this.filters.ap_ids.size > 0) {
            visibleRegs = this.allRegistrators.filter(r => this.filters.ap_ids.has(r.ap));
        }
        visibleRegs.sort((a,b) => a.name.localeCompare(b.name));
        
        this.regRow.innerHTML = '';
        const allRegBtn = document.createElement('button');
        allRegBtn.className = `filter-btn ${this.filters.registrator_ids.size === 0 ? 'all-active' : ''}`;
        allRegBtn.textContent = 'Все регистраторы';
        allRegBtn.onclick = () => {
            this.filters.registrator_ids.clear();
            this.updateRegistratorFilterButtons();
            this.applyFiltersAndReload();
        };
        this.regRow.appendChild(allRegBtn);
        
        const disabled = (this.filters.ap_ids.size === 0);
        visibleRegs.forEach(reg => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${this.filters.registrator_ids.has(reg.id) ? 'active' : ''}`;
            btn.textContent = reg.name;
            if (disabled) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.onclick = () => {
                    if (this.filters.registrator_ids.has(reg.id)) {
                        this.filters.registrator_ids.delete(reg.id);
                    } else {
                        this.filters.registrator_ids.add(reg.id);
                    }
                    if (this.filters.registrator_ids.size === visibleRegs.length) {
                        this.filters.registrator_ids.clear();
                    }
                    this.updateRegistratorFilterButtons();
                    this.applyFiltersAndReload();
                };
            }
            this.regRow.appendChild(btn);
        });
    }
    
    async applyFiltersAndReload() {
        const dateFromInput = document.getElementById('analytics-date-from');
        const dateToInput = document.getElementById('analytics-date-to');
        if (dateFromInput && dateToInput) {
            this.filters.date_from = dateFromInput.value;
            this.filters.date_to = dateToInput.value;
        }
        await this.loadAnalyticsData();
        this.container.innerHTML = '';
        this.renderFilters();
        this.renderKPI();
        this.renderStatusDistribution();
        this.renderDailyStatus();
        this.renderTopBreakdowns();
        this.renderProblemRegistrators();
        this.renderLongestBreakdowns();
    }
    
    renderKPI() {
        const kpi = this.data.kpi;
        const kpiDiv = document.createElement('div');
        kpiDiv.className = 'kpi-cards';
        kpiDiv.style.cssText = 'display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 30px;';
        kpiDiv.innerHTML = `
            <div class="kpi-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px; min-width: 150px; text-align: center;">
                <h3>Камер</h3>
                <div style="font-size: 32px; font-weight: bold;">${kpi.total_cameras}</div>
            </div>
            <div class="kpi-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px; min-width: 150px; text-align: center;">
                <h3>Регистраторов</h3>
                <div style="font-size: 32px; font-weight: bold;">${kpi.total_registrators}</div>
            </div>
            <div class="kpi-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px; min-width: 150px; text-align: center;">
                <h3>АП</h3>
                <div style="font-size: 32px; font-weight: bold;">${kpi.total_aps}</div>
            </div>
            <div class="kpi-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px; min-width: 150px; text-align: center;">
                <h3>Охват за 7д</h3>
                <div style="font-size: 32px; font-weight: bold;">${kpi.report_coverage_7d}%</div>
            </div>
            <div class="kpi-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px; min-width: 150px; text-align: center;">
                <h3>Исправных</h3>
                <div style="font-size: 32px; font-weight: bold;">${kpi.healthy_percent}%</div>
            </div>
        `;
        this.container.appendChild(kpiDiv);
    }
    
    renderStatusDistribution() {
        const dist = this.data.status_distribution;
        const labels = Object.keys(dist);
        const values = Object.values(dist);
        
        const colorMap = {
            'Исправна': '#2ecc71',
            'Частично не исправна': '#f39c12',
            'Неисправна': '#e74c3c',
            'Отключена': '#95a5a6',
            'Проба': '#3498db',
            'Нет данных': '#bdc3c7'
        };
        const backgroundColors = labels.map(label => colorMap[label] || '#95a5a6');
        
        const container = document.createElement('div');
        container.style.cssText = 'background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; max-width: 600px;';
        container.innerHTML = '<h3>Распределение состояний на выбранную дату</h3><canvas id="status-chart" style="height:300px; max-width:100%;"></canvas>';
        this.container.appendChild(container);
        
        const canvas = container.querySelector('#status-chart');
        const ctx = canvas.getContext('2d');
        if (this.charts.statusChart) this.charts.statusChart.destroy();
        this.charts.statusChart = new Chart(ctx, {
            type: 'pie',
            data: { labels, datasets: [{ data: values, backgroundColor: backgroundColors }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'right' } } }
        });
    }
    
    renderDailyStatus() {
        const daily = this.data.daily_status;
        const labels = daily.map(d => d.date.slice(5));
        const datasets = [];
        const conditions = ['Исправна', 'Частично не исправна', 'Неисправна', 'Отключена', 'Проба'];
        const colorMap = {
            'Исправна': '#2ecc71',
            'Частично не исправна': '#f39c12',
            'Неисправна': '#e74c3c',
            'Отключена': '#95a5a6',
            'Проба': '#3498db'
        };
        conditions.forEach(cond => {
            datasets.push({
                label: cond,
                data: daily.map(d => d[cond] || 0),
                borderColor: colorMap[cond] || '#000',
                backgroundColor: 'transparent',
                tension: 0.1,
                fill: false,
                pointRadius: 2
            });
        });
        
        const container = document.createElement('div');
        container.style.cssText = 'background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px;';
        container.innerHTML = '<h3>Динамика состояний</h3><canvas id="trend-chart" style="height:300px; max-width:100%;"></canvas>';
        this.container.appendChild(container);
        
        const canvas = container.querySelector('#trend-chart');
        const ctx = canvas.getContext('2d');
        if (this.charts.trendChart) this.charts.trendChart.destroy();
        this.charts.trendChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: true, plugins: { tooltip: { mode: 'index', intersect: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Количество камер' } } } }
        });
    }
    
    renderTopBreakdowns() {
        const breakdowns = this.data.top_breakdowns;
        if (!breakdowns.length) return;
        const labels = breakdowns.map(b => b.breakdown);
        const values = breakdowns.map(b => b.count);
        
        const container = document.createElement('div');
        container.style.cssText = 'background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px;';
        container.innerHTML = '<h3>Топ поломок</h3><canvas id="breakdown-chart" style="height:300px; max-width:100%;"></canvas>';
        this.container.appendChild(container);
        
        const canvas = container.querySelector('#breakdown-chart');
        const ctx = canvas.getContext('2d');
        if (this.charts.breakdownChart) this.charts.breakdownChart.destroy();
        this.charts.breakdownChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Количество', data: values, backgroundColor: '#e74c3c' }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true }
        });
    }
    
    renderProblemRegistrators() {
        const registrators = this.data.problem_registrators;
        if (!registrators.length) return;
        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.cssText = 'width:100%; border-collapse: collapse; margin-bottom:30px; background:white;';
        table.innerHTML = `
            <thead><tr><th>Регистратор</th><th>Всего камер</th><th>Неисправных</th><th>% неисправных</th></tr></thead>
            <tbody>
                ${registrators.map(r => `
                    <tr>
                        <td>${this.escapeHtml(r.registrator_name)}</td>
                        <td>${r.total_cameras}</td>
                        <td>${r.unhealthy}</td>
                        <td>${r.unhealthy_percent}%</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px;';
        wrapper.innerHTML = '<h3>Проблемные регистраторы</h3>';
        wrapper.appendChild(table);
        this.container.appendChild(wrapper);
    }
    
    renderLongestBreakdowns() {
        const cameras = this.data.longest_breakdowns;
        if (!cameras.length) return;
        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.cssText = 'width:100%; border-collapse: collapse; margin-bottom:30px; background:white;';
        table.innerHTML = `
            <thead><tr><th>Камера</th><th>Расположение</th><th>Состояние</th><th>Поломка</th><th>Дней</th><th>С</th></tr></thead>
            <tbody>
                ${cameras.map(c => `
                    <tr>
                        <td>${this.escapeHtml(c.camera_name)}</td>
                        <td>${this.escapeHtml(c.location)}</td>
                        <td>${this.escapeHtml(c.condition)}</td>
                        <td>${this.escapeHtml(c.breakdown)}</td>
                        <td>${c.days}</td>
                        <td>${c.start_date}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px;';
        wrapper.innerHTML = '<h3>Самые долгие поломки</h3>';
        wrapper.appendChild(table);
        this.container.appendChild(wrapper);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

window.CCTV.AnalyticsView = new AnalyticsView();