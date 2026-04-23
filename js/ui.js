// UI Module - Handles all DOM manipulation and rendering

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function highlightText(container, text, query) {
    const str = String(text ?? '');
    if (!query || !str.toLowerCase().includes(query.toLowerCase())) {
        container.textContent = str;
        return;
    }
    const lowerStr = str.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let lastIndex = 0;
    let idx;
    while ((idx = lowerStr.indexOf(lowerQuery, lastIndex)) !== -1) {
        if (idx > lastIndex) {
            container.appendChild(document.createTextNode(str.substring(lastIndex, idx)));
        }
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = str.substring(idx, idx + lowerQuery.length);
        container.appendChild(mark);
        lastIndex = idx + lowerQuery.length;
    }
    if (lastIndex < str.length) {
        container.appendChild(document.createTextNode(str.substring(lastIndex)));
    }
}

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

    showData: function (headers, data, stats, lastImportTime, pagination, query = '') {
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
        this.renderTable(headers, data, query);
        this.renderCards(headers, data, query);
    },

    updateStats: function (stats, lastImportTime) {
        document.getElementById('stat-open').textContent = stats.open;
        document.getElementById('stat-closed').textContent = stats.closed;
        document.getElementById('stat-defer').textContent = stats.defer;
        const cancelEl = document.getElementById('stat-cancel');
        if (cancelEl) cancelEl.textContent = stats.cancel || 0;
    },

    updatePagination: function (pagination) {
        const { currentPage, totalPages } = pagination;

        this.elements.pageInfo.textContent = `Sayfa ${currentPage} / ${totalPages}`;

        // Disable/enable buttons
        this.elements.prevPageBtn.disabled = currentPage === 1;
        this.elements.nextPageBtn.disabled = currentPage === totalPages;
    },

    // Display labels for specific column names
    HEADER_LABELS: {
        'estimated_mh': 'EST-MH',
        'actual_mh': 'ACT-MH',
    },

    // Column names that should always render as tight (no-wrap, min-width)
    TIGHT_HEADER_NAMES: new Set(['estimated_mh', 'actual_mh', 'completed_on', 'status', 'Oran %', 'Uçak İsmi']),

    renderTable: function (headers, data, query = '') {
        // Clear Headers
        this.elements.tableHead.innerHTML = '';
        const trHead = document.createElement('tr');

        headers.forEach((h, index) => {
            const th = document.createElement('th');
            const label = this.HEADER_LABELS[h] || h;
            th.textContent = label;
            th.onclick = () => window.App.sortData(index);

            // Add sorting indicator if active
            if (window.App.state.sort.colIndex === index) {
                th.textContent += window.App.state.sort.asc ? ' ▲' : ' ▼';
            }

            // Tight cell: fixed indices + name-based
            if ([0, 2, 3, 5, 8, 9, 10].includes(index) || this.TIGHT_HEADER_NAMES.has(h)) {
                th.classList.add('tight-cell');
            }

            trHead.appendChild(th);
        });

        // ASDP button column header
        const thAsdp = document.createElement('th');
        thAsdp.textContent = 'ASDP';
        thAsdp.classList.add('tight-cell');
        thAsdp.style.cssText = 'cursor:default';
        trHead.appendChild(thAsdp);

        this.elements.tableHead.appendChild(trHead);

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
                    const departments = ['', 'Cabin', 'Ortak Cabin', 'TEKSTIL', 'AVI', 'MEC', 'STR', 'SEAT', 'KAPLAMA'];
                    departments.forEach(dept => {
                        const opt = document.createElement('option');
                        opt.value = dept;
                        opt.textContent = dept || '-';
                        if (dept === cell) opt.selected = true;
                        select.appendChild(opt);
                    });
                    select.onchange = (e) => window.App.updateDepartment(row, e.target.value);
                    td.appendChild(select);
                } else if (headers[i] === 'Not') {
                    const noteWrapper = document.createElement('div');
                    noteWrapper.className = 'note-cell-wrapper';

                    const textarea = document.createElement('textarea');
                    textarea.className = 'table-note-textarea';
                    textarea.value = cell || '';
                    textarea.placeholder = 'Not...';
                    const debouncedNoteUpdate = debounce((val) => window.App.updateNote(row, val), 300);
                    textarea.oninput = (e) => debouncedNoteUpdate(e.target.value);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-delete-note';
                    deleteBtn.innerHTML = '🗑️';
                    deleteBtn.title = 'Notu Sil';
                    deleteBtn.onclick = () => {
                        if (confirm('Notu silmek istediğinize emin misiniz?')) {
                            textarea.value = '';
                            window.App.updateNote(row, '');
                        }
                    };

                    noteWrapper.appendChild(textarea);
                    noteWrapper.appendChild(deleteBtn);
                    td.appendChild(noteWrapper);
                } else {
                    // Format numeric MH values to 2 decimal places
                    if ((headers[i] === 'estimated_mh' || headers[i] === 'actual_mh') && cell !== '' && cell !== null) {
                        const num = parseFloat(cell);
                        highlightText(td, isNaN(num) ? cell : num.toFixed(2), query);
                    } else {
                        highlightText(td, cell, query);
                    }
                    if (headers[i] === 'status') {
                        const statusClass = { OPEN: 'status-open', CLOSED: 'status-closed', DEFER: 'status-defer', CANCEL: 'status-cancel' }[String(cell).trim().toUpperCase()];
                        if (statusClass) td.classList.add(statusClass);
                    }
                }

                // Wrap text columns (skip if the column is already tight by name)
                if ((i === 4 || i === 6) && !this.TIGHT_HEADER_NAMES.has(headers[i])) td.classList.add('wrap-text');

                // Tight cell: fixed indices + name-based
                if ([0, 2, 3, 5, 8, 9, 10].includes(i) || this.TIGHT_HEADER_NAMES.has(headers[i])) td.classList.add('tight-cell');

                tr.appendChild(td);
            });
            // ASDP button cell
            const tdAsdp = document.createElement('td');
            tdAsdp.classList.add('tight-cell');
            const asdpBtn = document.createElement('button');
            asdpBtn.className = 'btn-add-to-asdp';
            asdpBtn.title = 'İşler bölümüne ekle (ASDP)';
            asdpBtn.textContent = '+';
            asdpBtn.onclick = (e) => {
                e.stopPropagation();
                const estIdx = headers.indexOf('estimated_mh');
                const actIdx = headers.indexOf('actual_mh');
                const estimated = parseFloat(estIdx !== -1 ? row[estIdx] : 0) || 0;
                const actual = parseFloat(actIdx !== -1 ? row[actIdx] : 0) || 0;
                const remaining = Math.max(0, estimated - actual);
                const taskName = row[3] || row[2] || 'NRC Görev';
                const url = `https://ovarthy-bot.github.io/asdp/add.html?name=${encodeURIComponent(taskName)}&hours=${remaining}`;
                window.open(url, '_blank');
            };
            tdAsdp.appendChild(asdpBtn);
            tr.appendChild(tdAsdp);

            this.elements.tableBody.appendChild(tr);
        });
    },

    renderCards: function (headers, data, query = '') {
        this.elements.cardList.innerHTML = '';
        data.forEach(row => {
            const card = document.createElement('div');
            card.className = 'card';

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';

            // Use Task Card as Title
            const title = document.createElement('div');
            title.className = 'card-title';
            highlightText(title, row[3] || row[2], query); // Task Card or WO

            const statusIdx = headers.indexOf('status');
            const statusVal = statusIdx !== -1 ? row[statusIdx] : '';
            const status = document.createElement('div');
            const cardStatusClass = { OPEN: 'status-open', CLOSED: 'status-closed', DEFER: 'status-defer', CANCEL: 'status-cancel' }[String(statusVal || '').trim().toUpperCase()];
            status.className = 'card-status' + (cardStatusClass ? ' ' + cardStatusClass : '');
            status.textContent = statusVal || ''; // Status

            const addBtn = document.createElement('button');
            addBtn.className = 'btn-add-to-asdp';
            addBtn.title = 'İşler bölümüne ekle (ASDP)';
            addBtn.textContent = '+';
            addBtn.onclick = (e) => {
                e.stopPropagation();
                const estIdx = headers.indexOf('estimated_mh');
                const actIdx = headers.indexOf('actual_mh');
                const estimated = parseFloat(estIdx !== -1 ? row[estIdx] : 0) || 0;
                const actual = parseFloat(actIdx !== -1 ? row[actIdx] : 0) || 0;
                const remaining = Math.max(0, estimated - actual);
                const taskName = row[3] || row[2] || 'NRC Görev';
                const url = `https://ovarthy-bot.github.io/asdp/add.html?name=${encodeURIComponent(taskName)}&hours=${remaining}`;
                window.open(url, '_blank');
            };

            cardHeader.appendChild(title);
            cardHeader.appendChild(addBtn);
            cardHeader.appendChild(status);
            card.appendChild(cardHeader);

            // Create rows for other data
            headers.forEach((h, i) => {
                // Skip Task Card and Status (already in header)
                if (i === 3 || h === 'status') return;

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
                    const departments = ['', 'Cabin', 'Ortak Cabin', 'TEKSTIL', 'AVI', 'MEC', 'STR', 'SEAT', 'KAPLAMA'];
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
                    highlightText(value, row[i], query);
                    if (h === 'status') {
                        const rowStatusClass = { OPEN: 'status-open', CLOSED: 'status-closed', DEFER: 'status-defer', CANCEL: 'status-cancel' }[String(row[i] || '').trim().toUpperCase()];
                        if (rowStatusClass) value.classList.add(rowStatusClass);
                    }
                }

                rowDiv.appendChild(label);
                rowDiv.appendChild(value);
                card.appendChild(rowDiv);
            });

            // Note Section
            const noteDiv = document.createElement('div');
            noteDiv.className = 'card-note';

            const noteHeader = document.createElement('div');
            noteHeader.className = 'card-note-header';

            const noteLabel = document.createElement('label');
            noteLabel.textContent = 'Notlar:';

            const deleteNoteBtn = document.createElement('button');
            deleteNoteBtn.className = 'btn-delete-note-mobile';
            deleteNoteBtn.innerHTML = '🗑️';
            deleteNoteBtn.title = 'Notu Sil';

            noteHeader.appendChild(noteLabel);
            noteHeader.appendChild(deleteNoteBtn);

            const noteInput = document.createElement('textarea');
            noteInput.placeholder = 'Not ekle...';

            const noteIndex = headers.indexOf('Not');
            if (noteIndex !== -1) {
                noteInput.value = row[noteIndex] || '';
                const debouncedCardNoteUpdate = debounce((val) => window.App.updateNote(row, val), 300);
                noteInput.oninput = (e) => debouncedCardNoteUpdate(e.target.value);

                deleteNoteBtn.onclick = () => {
                    if (confirm('Notu silmek istediğinize emin misiniz?')) {
                        noteInput.value = '';
                        window.App.updateNote(row, '');
                    }
                };
            }

            noteDiv.appendChild(noteHeader);
            noteDiv.appendChild(noteInput);
            card.appendChild(noteDiv);

            this.elements.cardList.appendChild(card);
        });
    }
};

export default UI;
