const UI = {
    elements: {
        tableHead: document.querySelector('#main-table thead'),
        tableBody: document.querySelector('#main-table tbody'),
        cardList: document.getElementById('card-list'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('empty-state'),
        dataContainer: document.getElementById('data-container'),
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

        // Filter Row
        const trFilter = document.createElement('tr');
        headers.forEach((h, index) => {
            const th = document.createElement('th');
            // Filterable columns: 0, 3, 5, 6
            if ([0, 3, 5, 6].includes(index)) {
                const select = document.createElement('select');
                select.innerHTML = '<option value="">Tümü</option>';

                // Get unique values
                const unique = [...new Set(App.state.allData.map(row => row[index]))].sort();
                unique.forEach(val => {
                    if (val) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        select.appendChild(opt);
                    }
                });

                // Set current filter value
                if (App.state.filters[index]) {
                    select.value = App.state.filters[index];
                }

                select.onchange = (e) => App.filterData(index, e.target.value);
                th.appendChild(select);
            }
            trFilter.appendChild(th);
        });
        this.elements.tableHead.appendChild(trFilter);

        // Clear Body
        this.elements.tableBody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');

            const wo = row[0];
            const plane = window.App.state.aircraftMap[wo] || "-";

            const visualRow = [...row];
            visualRow.splice(1, 0, plane); // Insert Plane at 1

            visualRow.forEach((cell, i) => {
                const td = document.createElement('td');

                // Logic for Desktop Notes (Last Column, Visual Index 11)
                // "Not" is originally index 10. +1 for Plane = 11.
                // Or just check if header is "Not".
                if (visualHeaders[i] === "Not") {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = cell || '';
                    input.className = 'table-note-input';
                    input.onchange = (e) => window.App.updateNote(row, e.target.value);
                    td.appendChild(input);
                } else {
                    td.textContent = cell;
                }

                if (i === 3 || i === 5) td.classList.add('wrap-text');
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

            const wo = row[0];
            const plane = window.App.state.aircraftMap[wo] || "-";

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';

            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = row[1] || row[0];

            const status = document.createElement('div');
            status.className = 'card-status';
            status.textContent = row[6] || '';

            cardHeader.appendChild(title);
            cardHeader.appendChild(status);
            card.appendChild(cardHeader);

            const planeDiv = document.createElement('div');
            planeDiv.className = 'card-row';
            planeDiv.innerHTML = '<span class="card-label">Uçak:</span><span class="card-value">' + plane + '</span>';
            card.appendChild(planeDiv);

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
