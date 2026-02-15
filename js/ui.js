const UI = {
    elements: {
        tableHead: document.querySelector('#main-table thead'),
        tableBody: document.querySelector('#main-table tbody'),
        cardList: document.getElementById('card-list'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('empty-state'),
        dataContainer: document.getElementById('data-container'),
        clearBtn: document.getElementById('clearDataBtn'),
        progressContainer: document.getElementById('progress-container'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text')
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

    showData: function (headers, data) {
        if (!data || data.length === 0) {
            this.elements.dataContainer.classList.add('hidden');
            this.elements.emptyState.classList.remove('hidden');
            this.elements.clearBtn.hidden = true;
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        this.elements.dataContainer.classList.remove('hidden');
        this.elements.clearBtn.hidden = false;

        this.renderTable(headers, data);
        this.renderCards(headers, data);
    },

    renderTable: function (headers, data) {
        // Clear Headers
        this.elements.tableHead.innerHTML = '';
        const trHead = document.createElement('tr');

        headers.forEach((h, index) => {
            const th = document.createElement('th');
            th.textContent = h;
            th.onclick = () => window.App.sortData(index); // App is global

            // Add sorting indicator if active
            if (window.App.state.sort.colIndex === index) {
                th.textContent += window.App.state.sort.asc ? ' ▲' : ' ▼';
            }

            // Specific columns tight
            // 0 (index 0), 1 (index 1), 3 (index 3), 6 (index 6), 7 (index 7), 8 (index 8)
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
            // Filterable columns: 0, 3, 5, 6
            if ([0, 3, 5, 6].includes(index)) {
                const select = document.createElement('select');
                select.innerHTML = '<option value="">Tümü</option>';

                // Get unique values
                const unique = [...new Set(window.App.state.allData.map(row => row[index]))].sort();
                unique.forEach(val => {
                    if (val) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        select.appendChild(opt);
                    }
                });

                // Set current filter value
                if (window.App.state.filters[index]) {
                    select.value = window.App.state.filters[index];
                }

                select.onchange = (e) => window.App.filterData(index, e.target.value);
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
            // Assuming the note is stored in the last column (index 9, after percentage)
            // But wait, the previous code pushed percentage at the end.
            // We need to check where the note is stored.
            // Let's assume the note is the LAST element in the row array.
            // Current structure: [0..8 (original), 9 (percentage)]
            // So note would be index 10.
            // We'll let App.js handle the column index logic, but here we just grab the last element if headers include "Not"

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
    }
};

window.UI = UI;
export default UI;
