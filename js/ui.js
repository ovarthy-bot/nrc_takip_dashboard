const UI = {
    elements: {
        tableHead: document.querySelector('#main-table thead'),
        tableBody: document.querySelector('#main-table tbody'),
        cardList: document.getElementById('card-list'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('empty-state'),
        dataContainer: document.getElementById('data-container'),
        clearBtn: document.getElementById('clearDataBtn'), // Might be removed in new HTML? Check index.html
        progressContainer: document.getElementById('progress-container'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        // New Elements
        statsBar: document.getElementById('stats-bar'),
        statOpen: document.getElementById('stat-open'),
        statClosed: document.getElementById('stat-closed'),
        statDefer: document.getElementById('stat-defer'),
        importDate: document.getElementById('import-date'),
        paginationControls: document.getElementById('pagination-controls'),
        prevPageBtn: document.getElementById('prev-page'),
        nextPageBtn: document.getElementById('next-page'),
        pageInfo: document.getElementById('page-info'),
        deptFilters: document.querySelectorAll('.filter-btn')
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

    showData: function (headers, data, page = 1, totalPages = 1) {
        if (!data || data.length === 0) {
            this.elements.dataContainer.classList.add('hidden');
            this.elements.emptyState.classList.remove('hidden');
            this.elements.statsBar.classList.add('hidden');
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        this.elements.dataContainer.classList.remove('hidden');
        this.elements.statsBar.classList.remove('hidden');

        this.renderTable(headers, data); // renders current page data
        this.renderCards(headers, data);
        this.updatePagination(page, totalPages);
    },

    updateStats: function (stats) {
        this.elements.statOpen.textContent = stats.open;
        this.elements.statClosed.textContent = stats.closed;
        this.elements.statDefer.textContent = stats.defer;
        this.elements.importDate.textContent = stats.date;
    },

    updatePagination: function (page, totalPages) {
        if (totalPages <= 1) {
            this.elements.paginationControls.classList.add('hidden');
            return;
        }
        this.elements.paginationControls.classList.remove('hidden');
        this.elements.pageInfo.textContent = `Sayfa ${page} / ${totalPages}`;
        this.elements.prevPageBtn.disabled = page === 1;
        this.elements.nextPageBtn.disabled = page === totalPages;
    },

    renderTable: function (headers, data) {
        // Clear Headers
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
            // 0 (index 0), 1 (index 1), 3 (index 3), 6 (index 6), 7 (index 7), 8 (index 8)
            if ([0, 1, 3, 6, 7, 8].includes(index)) {
                th.classList.add('tight-cell');
            }

            trHead.appendChild(th);
        });
        this.elements.tableHead.appendChild(trHead);

        // Filter Row - Removed as per new design request (using separate filter UI? or keeping it?)
        // The new HTML has a "filters-section" with department filters and a global search.
        // It does NOT explicitly show individual column filters in the table header in the HTML structure comments.
        // However, user just gave me the HTML skeleton. The table might still need column filters if desired.
        // But for now, let's stick to the skeleton which has specific filters outside.
        // I will keep the column rendering simple.

        // Clear Body
        this.elements.tableBody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach((cell, i) => {
                const td = document.createElement('td');
                td.textContent = cell;

                // Wrap text columns: 2, 4
                if (i === 2 || i === 4) td.classList.add('wrap-text');

                // Tight cell columns
                if ([0, 1, 3, 6, 7, 8].includes(i)) td.classList.add('tight-cell');

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

            // Use 2nd column (Task Card) as Title if available, else 1st
            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = row[1] || row[0]; // Task Card or WO

            const status = document.createElement('div');
            status.className = 'card-status';
            status.textContent = row[6] || ''; // Status

            cardHeader.appendChild(title);
            cardHeader.appendChild(status);
            card.appendChild(cardHeader);

            // Create rows for other data
            headers.forEach((h, i) => {
                // Skip if it's the title we just showed
                if (i === 1) return;

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

            // Note Section
            const noteDiv = document.createElement('div');
            noteDiv.className = 'card-note';

            const noteLabel = document.createElement('label');
            noteLabel.textContent = 'Notlar:';

            const noteInput = document.createElement('textarea');
            noteInput.placeholder = 'Not ekle...';

            // Note is likely the last column.
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
