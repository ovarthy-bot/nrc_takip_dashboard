import App from './app.js';

const UI = {
    elements: {
        tableHead: document.querySelector('#main-table thead'),
        tableBody: document.querySelector('#main-table tbody'),
        cardList: document.getElementById('card-list'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('empty-state'),
        dataContainer: document.getElementById('data-container'),
        progressContainer: document.getElementById('progress-container'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        statsBar: document.getElementById('stats-bar'),
        statOpen: document.getElementById('stat-open'),
        statClosed: document.getElementById('stat-closed'),
        statDefer: document.getElementById('stat-defer'),
        importDate: document.getElementById('import-date'),
        paginationControls: document.getElementById('pagination-controls'),
        pageInfo: document.getElementById('page-info'),
        prevPageBtn: document.getElementById('prev-page'),
        nextPageBtn: document.getElementById('next-page'),
        deptFilters: document.getElementById('dept-filters-container')
    },

    init: function () {
        this.bindPaginationEvents();
        this.bindFilterEvents();
    },

    bindPaginationEvents: function () {
        this.elements.prevPageBtn.addEventListener('click', () => App.changePage(-1));
        this.elements.nextPageBtn.addEventListener('click', () => App.changePage(1));
    },

    bindFilterEvents: function () {
        this.elements.deptFilters.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dept = e.target.dataset.dept;
                e.target.classList.toggle('active');
                App.toggleDepartmentFilter(dept);
            });
        });
    },

    toggleProgress: function (show) {
        if (show) {
            this.elements.progressContainer.classList.remove('hidden');
        } else {
            this.elements.progressContainer.classList.add('hidden');
        }
    },

    updateProgress: function (percent, text) {
        this.elements.progressFill.style.width = `${percent}%`;
        if (text) this.elements.progressText.textContent = text;
    },

    toggleLoading: function (show) {
        if (show) {
            this.elements.loading.classList.remove('hidden');
            this.elements.dataContainer.classList.add('hidden');
            this.elements.emptyState.classList.add('hidden');
            this.elements.statsBar.classList.add('hidden');
            this.elements.paginationControls.classList.add('hidden');
        } else {
            this.elements.loading.classList.add('hidden');
        }
    },

    updateStats: function (stats) {
        this.elements.statOpen.textContent = stats.open;
        this.elements.statClosed.textContent = stats.closed;
        this.elements.statDefer.textContent = stats.defer;
        this.elements.importDate.textContent = stats.date || '-';
        this.elements.statsBar.classList.remove('hidden');
    },

    updatePagination: function (current, total) {
        this.elements.pageInfo.textContent = `Sayfa ${current} / ${total}`;
        this.elements.prevPageBtn.disabled = current <= 1;
        this.elements.nextPageBtn.disabled = current >= total;
        this.elements.paginationControls.classList.remove('hidden');
    },

    showData: function (headers, data, pageData, showPagination = true) {
        if (!data || data.length === 0) {
            this.elements.dataContainer.classList.add('hidden');
            this.elements.emptyState.classList.remove('hidden');
            this.elements.statsBar.classList.add('hidden');
            this.elements.paginationControls.classList.add('hidden');
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        this.elements.dataContainer.classList.remove('hidden');

        // Render headers once (or update if needed)
        this.renderTableHeaders(headers);

        // Render rows for CURRENT PAGE
        this.renderTableBody(pageData);
        this.renderCards(headers, pageData);
    },

    renderTableHeaders: function (headers) {
        this.elements.tableHead.innerHTML = '';
        const trHead = document.createElement('tr');

        headers.forEach((h, index) => {
            const th = document.createElement('th');
            th.textContent = h;
            th.onclick = () => App.sortData(index);

            // Add sorting indicator if active
            if (App.state.sort.colIndex === index) {
                th.textContent += App.state.sort.asc ? ' ▲' : ' ▼';
            }

            // Specific columns tight
            if ([0, 1, 3, 6, 7, 8].includes(index)) {
                th.classList.add('tight-cell');
            }

            trHead.appendChild(th);
        });
        this.elements.tableHead.appendChild(trHead);

        // Filter Row
        const trFilter = document.createElement('tr');
        headers.forEach((h, index) => {
            const th = document.createElement('th');
            // Filterable columns: 0, 3, 5, 6, and potentially "Uçak İsmi" (if index 0 is used for it)
            // Let's make it generic: anything with text content could be filterable.
            // But strict list: 
            // If we insert "Uçak İsmi" at index 0, everything shifts.
            // We'll rely on App logic to tell us which columns to filter, or just try to support all useful ones.

            // Let's support dropdowns for Status (index ?), and Aircraft (index ?)
            const uniqueValues = App.getUniqueValues(index);
            if (uniqueValues.length > 0 && uniqueValues.length < 50) { // Only show dropdown if reasonable number of options
                const select = document.createElement('select');
                select.innerHTML = '<option value="">Tümü</option>';

                uniqueValues.sort().forEach(val => {
                    if (val) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        select.appendChild(opt);
                    }
                });

                if (App.state.filters[index]) {
                    select.value = App.state.filters[index];
                }

                select.onchange = (e) => App.filterData(index, e.target.value);
                select.onclick = (e) => e.stopPropagation(); // Prevent sort
                th.appendChild(select);
            }

            trFilter.appendChild(th);
        });
        this.elements.tableHead.appendChild(trFilter);
    },

    renderTableBody: function (data) {
        this.elements.tableBody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach((cell, i) => {
                const td = document.createElement('td');
                td.textContent = cell;

                // Wrap text columns: 2, 4 (Original indices, might shift!)
                // Better heuristic: if length > 50 wrap?
                if (String(cell).length > 30) td.classList.add('wrap-text');

                tr.appendChild(td);
            });
            this.elements.tableBody.appendChild(tr);
        });
    },

    renderCards: function (headers, data) {
        this.elements.cardList.innerHTML = '';
        data.forEach(row => {
            const card = document.createElement('div');
            card.className = 'card';

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';

            // Heuristic for Title: WO (0) or Task (1)
            // If we inserted Aircraft Name at 0, then WO is 1?
            // Let's just take the first two columns.
            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = `${row[0]} - ${row[1]}`;

            const cardHeaderRight = document.createElement('div');
            // Find Status column (usually contains "OPEN", "CLOSED")
            const statusIdx = row.findIndex(c => ['OPEN', 'CLOSED', 'DEFER'].includes(String(c)));
            if (statusIdx !== -1) {
                const status = document.createElement('div');
                status.className = 'card-status';
                status.textContent = row[statusIdx];
                cardHeaderRight.appendChild(status);
            }

            cardHeader.appendChild(title);
            cardHeader.appendChild(cardHeaderRight);
            card.appendChild(cardHeader);

            // Create rows for other data
            headers.forEach((h, i) => {
                const rowDiv = document.createElement('div');
                rowDiv.className = 'card-row';

                const label = document.createElement('span');
                label.className = 'card-label';
                label.textContent = h + ':';

                const value = document.createElement('span');
                value.className = 'card-value';
                value.textContent = row[i];

                rowDiv.appendChild(label);
                rowDiv.appendChild(value);
                card.appendChild(rowDiv);
            });

            // Department Section
            const deptDiv = document.createElement('div');
            deptDiv.className = 'card-dept';
            const deptLabel = document.createElement('div');
            deptLabel.className = 'card-label';
            deptLabel.textContent = 'Bölüm:';
            deptDiv.appendChild(deptLabel);

            const deptContainer = document.createElement('div');
            deptContainer.className = 'dept-buttons';

            const departments = ["Cabin", "Ortak Cabin", "AVI", "MEC", "STR", "OTHER"];
            // Get current depts for this row
            const deptIdx = headers.indexOf("Bölüm");
            const currentDepts = (deptIdx !== -1 && row[deptIdx]) ? String(row[deptIdx]).split(',') : [];

            departments.forEach(dept => {
                const btn = document.createElement('button');
                btn.className = 'filter-btn btn-xs'; // Reuse filter-btn styles
                btn.textContent = dept;
                if (currentDepts.includes(dept)) {
                    btn.classList.add('active');
                }

                btn.onclick = (e) => {
                    e.target.classList.toggle('active');
                    App.updateRowDepartment(row, dept);
                };
                deptContainer.appendChild(btn);
            });
            deptDiv.appendChild(deptContainer);
            card.appendChild(deptDiv);

            // Note Section
            const noteDiv = document.createElement('div');
            noteDiv.className = 'card-note';

            const noteLabel = document.createElement('label');
            noteLabel.textContent = 'Notlar:';

            const noteInput = document.createElement('textarea');
            noteInput.placeholder = 'Not ekle...';

            // Check for "Not" column
            const noteIndex = headers.indexOf('Not');
            if (noteIndex !== -1) {
                noteInput.value = row[noteIndex] || '';
                noteInput.onchange = (e) => App.updateNote(row, e.target.value);
            }

            noteDiv.appendChild(noteLabel);
            noteDiv.appendChild(noteInput);
            card.appendChild(noteDiv);

            this.elements.cardList.appendChild(card);
        });
    }
};

export default UI;
