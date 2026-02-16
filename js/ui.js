// UI Module - Handles all DOM manipulation and rendering
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
        filtersSection: document.getElementById('filters-section'),
        paginationControls: document.getElementById('pagination-controls'),
        pageInfo: document.getElementById('page-info'),
        prevPageBtn: document.getElementById('prev-page'),
        nextPageBtn: document.getElementById('next-page')
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
        } else {
            this.elements.loading.classList.add('hidden');
        }
    },

    showData: function (headers, data, stats, lastImportTime, pagination) {
        if (!data || data.length === 0) {
            this.elements.dataContainer.classList.add('hidden');
            this.elements.emptyState.classList.remove('hidden');
            this.elements.statsBar.classList.add('hidden');
            this.elements.filtersSection.classList.add('hidden');
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        this.elements.dataContainer.classList.remove('hidden');
        this.elements.statsBar.classList.remove('hidden');
        this.elements.filtersSection.classList.remove('hidden');

        // Update stats
        this.updateStats(stats, lastImportTime);

        // Update pagination info
        this.updatePagination(pagination);

        // Render table and cards
        this.renderTable(headers, data);
        this.renderCards(headers, data);
    },

    updateStats: function (stats, lastImportTime) {
        document.getElementById('stat-open').textContent = stats.open;
        document.getElementById('stat-closed').textContent = stats.closed;
        document.getElementById('stat-defer').textContent = stats.defer;

        if (lastImportTime) {
            const date = new Date(lastImportTime);
            const formatted = date.toLocaleString('tr-TR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            document.getElementById('last-import-time').textContent = formatted;
        }
    },

    updatePagination: function (pagination) {
        const { currentPage, totalPages } = pagination;

        this.elements.pageInfo.textContent = `Sayfa ${currentPage} / ${totalPages}`;

        // Disable/enable buttons
        this.elements.prevPageBtn.disabled = currentPage === 1;
        this.elements.nextPageBtn.disabled = currentPage === totalPages;
    },

    renderTable: function (headers, data) {
        // Clear Headers
        this.elements.tableHead.innerHTML = '';
        const trHead = document.createElement('tr');

        headers.forEach((h, index) => {
            const th = document.createElement('th');
            th.textContent = h;
            th.onclick = () => window.App.sortData(index);

            // Add sorting indicator if active
            if (window.App.state.sort.colIndex === index) {
                th.textContent += window.App.state.sort.asc ? ' ▲' : ' ▼';
            }

            // Specific columns tight (adjusted for new columns)
            // Aircraft Name (0), Department (1), WO (2), Task Card (3), etc.
            if ([0, 1, 2, 3, 5, 8, 9, 10].includes(index)) {
                th.classList.add('tight-cell');
            }

            trHead.appendChild(th);
        });
        this.elements.tableHead.appendChild(trHead);

        // Filter Row
        const trFilter = document.createElement('tr');
        headers.forEach((h, index) => {
            const th = document.createElement('th');
            // Filterable columns: WO (2), Status (8), etc.
            if ([2, 5, 7, 8].includes(index)) {
                const select = document.createElement('select');
                select.innerHTML = '<option value="">Tümü</option>';

                // Get unique values from ALL data, not just current page
                const unique = [...new Set(window.App.state.allData.map(row => row[index]))].sort();
                unique.forEach(val => {
                    if (val) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        select.appendChild(opt);
                    }
                });

                select.onchange = (e) => {
                    // This is a column-specific filter, not implemented in simplified version
                    // Can be added if needed
                };
                th.appendChild(select);
            }
            trFilter.appendChild(th);
        });
        this.elements.tableHead.appendChild(trFilter);

        // Clear Body
        this.elements.tableBody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach((cell, i) => {
                const td = document.createElement('td');

                // Department dropdown (index 1)
                if (i === 1) {
                    const select = document.createElement('select');
                    select.className = 'dept-select';
                    const departments = ['', 'Cabin', 'Ortak Cabin', 'AVI', 'MEC', 'STR', 'OTHER'];
                    departments.forEach(dept => {
                        const opt = document.createElement('option');
                        opt.value = dept;
                        opt.textContent = dept || '-';
                        if (dept === cell) opt.selected = true;
                        select.appendChild(opt);
                    });
                    select.onchange = (e) => window.App.updateDepartment(row, e.target.value);
                    td.appendChild(select);
                } else {
                    td.textContent = cell;
                }

                // Wrap text columns
                if (i === 4 || i === 6) td.classList.add('wrap-text');

                // Tight cell columns
                if ([0, 1, 2, 3, 5, 8, 9, 10].includes(i)) td.classList.add('tight-cell');

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

            // Use Task Card as Title
            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = row[3] || row[2]; // Task Card or WO

            const status = document.createElement('div');
            status.className = 'card-status';
            status.textContent = row[8] || ''; // Status

            cardHeader.appendChild(title);
            cardHeader.appendChild(status);
            card.appendChild(cardHeader);

            // Create rows for other data
            headers.forEach((h, i) => {
                // Skip Task Card (already in header)
                if (i === 3) return;

                const rowDiv = document.createElement('div');
                rowDiv.className = 'card-row';

                const label = document.createElement('span');
                label.className = 'card-label';
                label.textContent = h + ':';

                const value = document.createElement('span');
                value.className = 'card-value';

                // Department dropdown for mobile
                if (i === 1) {
                    const select = document.createElement('select');
                    select.className = 'dept-select-mobile';
                    const departments = ['', 'Cabin', 'Ortak Cabin', 'AVI', 'MEC', 'STR', 'OTHER'];
                    departments.forEach(dept => {
                        const opt = document.createElement('option');
                        opt.value = dept;
                        opt.textContent = dept || '-';
                        if (dept === row[i]) opt.selected = true;
                        select.appendChild(opt);
                    });
                    select.onchange = (e) => window.App.updateDepartment(row, e.target.value);
                    value.appendChild(select);
                } else {
                    value.textContent = row[i];
                }

                rowDiv.appendChild(label);
                rowDiv.appendChild(value);
                card.appendChild(rowDiv);
            });

            // Note Section
            const noteDiv = document.createElement('div');
            noteDiv.className = 'card-note';

            const noteLabel = document.createElement('label');
            noteLabel.textContent = 'Notlar:';

            const noteInput = document.createElement('textarea');
            noteInput.placeholder = 'Not ekle...';

            const noteIndex = headers.indexOf('Not');
            if (noteIndex !== -1) {
                noteInput.value = row[noteIndex] || '';
                noteInput.onchange = (e) => window.App.updateNote(row, e.target.value);
            }

            noteDiv.appendChild(noteLabel);
            noteDiv.appendChild(noteInput);
            card.appendChild(noteDiv);

            this.elements.cardList.appendChild(card);
        });
    }
};

export default UI;
