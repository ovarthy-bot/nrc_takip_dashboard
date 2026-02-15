const UI = {
    elements: {
        tableHead: document.querySelector('#data-table thead'),
        tableBody: document.querySelector('#data-table tbody'),
        cardList: document.getElementById('card-list'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('empty-state'),
        dataContainer: document.getElementById('data-container'),
        clearBtn: document.getElementById('clearDataBtn'),
        progressContainer: document.getElementById('progress-container'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),

        statOpen: document.getElementById('stat-open'),
        statClosed: document.getElementById('stat-closed'),
        statDefer: document.getElementById('stat-defer'),
        lastImport: document.getElementById('last-import-time'),

        pageInfo: document.getElementById('pageInfo'),
        prevPageBtn: document.getElementById('prevPage'),
        nextPageBtn: document.getElementById('nextPage'),

        aircraftMapList: document.getElementById('aircraft-map-list'),
        modal: document.getElementById('aircraftModal'),
        closeModal: document.querySelector('.close-modal'),
        mobileFilters: document.getElementById('mobile-filters')
    },

    toggleProgress: function (show) {
        if (show) {
            this.elements.progressContainer.classList.remove('hidden');
        } else {
            this.elements.progressContainer.classList.add('hidden');
        }
    },

    updateProgress: function (percent, text) {
        this.elements.progressFill.style.width = percent + '%';
        this.elements.progressText.textContent = text || Math.round(percent) + '%';
    },

    toggleLoading: function (show) {
        if (show) {
            this.elements.loading.classList.remove('hidden');
        } else {
            this.elements.loading.classList.add('hidden');
        }
    },

    showData: function (headers, data, pagination) {
        if (!data || (data.length === 0 && (!window.App.state.allData || window.App.state.allData.length === 0))) {
            this.elements.dataContainer.classList.add('hidden');
            this.elements.emptyState.classList.remove('hidden');
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        this.elements.dataContainer.classList.remove('hidden');

        this.renderTable(headers, data);
        this.renderCards(headers, data);
        this.renderPagination(pagination);
    },

    updateStats: function (open, closed, defer) {
        this.elements.statOpen.textContent = open;
        this.elements.statClosed.textContent = closed;
        this.elements.statDefer.textContent = defer;
    },

    updateLastImport: function (timestamp) {
        this.elements.lastImport.textContent = `Son Import: ${timestamp || '-'}`;
    },

    renderPagination: function (pagination) {
        if (!pagination) return;
        const { currentPage, totalPages, totalItems } = pagination;
        this.elements.pageInfo.textContent = `Sayfa ${currentPage} / ${totalPages} (Top: ${totalItems})`;
        this.elements.prevPageBtn.disabled = currentPage <= 1;
        this.elements.nextPageBtn.disabled = currentPage >= totalPages;

        this.elements.prevPageBtn.onclick = () => window.App.changePage(currentPage - 1);
        this.elements.nextPageBtn.onclick = () => window.App.changePage(currentPage + 1);
    },

    renderTable: function (headers, data) {
        // Clear Headers
        this.elements.tableHead.innerHTML = '';
        const trHead = document.createElement('tr');

        // Visual Headers: Insert "Uçak İsmi" after WO (Index 0)
        const visualHeaders = [...headers];
        visualHeaders.splice(1, 0, "Uçak İsmi");

        visualHeaders.forEach((h, index) => {
            const th = document.createElement('th');
            th.textContent = h;

            // Adjust index for sorting callback
            let sortIndex = -1;
            if (index === 0) sortIndex = 0;
            else if (index > 1) sortIndex = index - 1;

            if (sortIndex !== -1) {
                th.onclick = () => window.App.sortData(sortIndex);
                // Add sorting indicator
                if (window.App.state.sort.colIndex === sortIndex) {
                    th.textContent += window.App.state.sort.asc ? ' ▲' : ' ▼';
                }
            } else {
                th.classList.add('no-sort');
            }

            if ([0, 1, 2, 4, 7, 8, 9].includes(index)) { // Tight cells
                th.classList.add('tight-cell');
            }

            trHead.appendChild(th);
        });
        this.elements.tableHead.appendChild(trHead);

        // Clear Body
        this.elements.tableBody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');

            // We need to construct visual row: [WO, Plane, TaskCard, ...]
            const wo = row[0];
            const plane = window.App.state.aircraftMap[wo] || "-";

            const visualRow = [...row];
            visualRow.splice(1, 0, plane); // Insert Plane at 1

            visualRow.forEach((cell, i) => {
                const td = document.createElement('td');
                td.textContent = cell;

                // Adjust classes based on visual index
                if (i === 3 || i === 5) td.classList.add('wrap-text'); // Konu, etc.
                if ([0, 1, 2, 4, 7, 8, 9].includes(i)) td.classList.add('tight-cell');

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

            // Lookup Plane
            const wo = row[0];
            const plane = window.App.state.aircraftMap[wo] || "-";

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';

            // Title: Task Card (Index 1)
            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = row[1] || row[0];

            const status = document.createElement('div');
            status.className = 'card-status';
            status.textContent = row[6] || ''; // Status

            cardHeader.appendChild(title);
            cardHeader.appendChild(status);
            card.appendChild(cardHeader);

            // Plane Row
            const planeDiv = document.createElement('div');
            planeDiv.className = 'card-row';
            planeDiv.innerHTML = '<span class="card-label">Uçak:</span><span class="card-value">' + plane + '</span>';
            card.appendChild(planeDiv);

            // Create rows for other data
            headers.forEach((h, i) => {
                // Skip Title (1)
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

            // Check if "Not" is in headers
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
    },

    // Modal Helpers
    openModal: function () { this.elements.modal.classList.remove('hidden'); },
    closeModal: function () { this.elements.modal.classList.add('hidden'); },

    renderMapList: function (map) {
        this.elements.aircraftMapList.innerHTML = '';
        Object.entries(map).forEach(([wo, plane]) => {
            const li = document.createElement('li');
            li.innerHTML = `<span><b>${wo}</b>: ${plane}</span>`;
            this.elements.aircraftMapList.appendChild(li);
        });
    }
};

window.UI = UI;
export default UI;
