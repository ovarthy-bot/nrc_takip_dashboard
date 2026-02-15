const App = {
    state: {
        allData: [],
        filteredData: [],
        headers: [],
        filters: {
            global: '',
            dept: ''
        },
        sort: {
            colIndex: -1,
            asc: true
        },
        pagination: {
            currentPage: 1,
            itemsPerPage: 50
        },
        metadata: {
            importDate: '-'
        }
    },

    init: function () {
        console.log('App initialized');
        this.bindEvents();
        this.loadData();
    },

    bindEvents: function () {
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFile(e));
        document.getElementById('search').addEventListener('input', (e) => this.handleSearch(e));

        // Department Filters
        const deptButtons = document.querySelectorAll('.filter-btn');
        deptButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all
                deptButtons.forEach(b => b.classList.remove('active'));
                // Add to clicked
                e.target.classList.add('active');
                // Filter
                this.filterData('dept', e.target.dataset.dept);
            });
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => this.changePage(-1));
        document.getElementById('next-page').addEventListener('click', () => this.changePage(1));
    },

    loadData: function () {
        const saved = Storage.load();
        if (saved) {
            this.state.allData = saved.data;
            this.state.headers = saved.headers;
            this.state.metadata = saved.metadata || { importDate: '-' };

            // Migration: Ensure "Not" column exists
            if (!this.state.headers.includes("Not")) {
                this.state.headers.push("Not");
                this.state.allData.forEach(row => {
                    row.push("");
                });
                this.saveData();
            }

            this.state.filteredData = this.state.allData;
            this.calculateStats();
            this.render();
        }
    },

    saveData: function () {
        Storage.save({
            headers: this.state.headers,
            data: this.state.allData,
            metadata: this.state.metadata
        });
    },

    handleFile: function (e) {
        const file = e.target.files[0];
        if (!file) return;

        UI.toggleLoading(true);
        UI.toggleProgress(true);
        UI.updateProgress(0, 'Dosya okunuyor...');

        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    this.processDataChunked(json);
                } catch (err) {
                    console.error(err);
                    alert('Dosya okunurken hata oluştu!');
                    UI.toggleLoading(false);
                    UI.toggleProgress(false);
                }
            };
            reader.readAsArrayBuffer(file);
        }, 100);
    },

    processDataChunked: function (rows) {
        if (!rows || rows.length < 2) {
            alert('Dosya boş veya geçersiz format!');
            UI.toggleLoading(false);
            UI.toggleProgress(false);
            return;
        }

        const headerRow = rows[0];
        const columns = [0, 1, 5, 6, 12, 7, 8, 15, 16]; // Indices to keep

        let headers = this.state.headers;
        if (headers.length === 0) {
            headers = columns.map(i => headerRow[i] || "");
            headers.push("Oran %");
            headers.push("Not");
        }

        const existingMap = new Map();
        const getKey = (row) => `${row[0]}_${row[1]}`;

        this.state.allData.forEach(row => {
            const key = getKey(row);
            existingMap.set(key, row);
        });

        const totalRows = rows.length - 1;
        let currentIndex = 1;
        const CHUNK_SIZE = 500;

        const processChunk = () => {
            const chunkEnd = Math.min(currentIndex + CHUNK_SIZE, rows.length);

            for (let i = currentIndex; i < chunkEnd; i++) {
                const row = rows[i];
                const mappedRow = columns.map((colIdx, idx) => {
                    let cell = row[colIdx];
                    if (cell === undefined || cell === null) cell = "";
                    if (idx === 4 && typeof cell === 'number') {
                        cell = this.excelDateToJSDate(cell);
                    }
                    return cell;
                });

                let val1 = parseFloat(mappedRow[7]);
                let val2 = parseFloat(mappedRow[8]);

                if (isNaN(val1)) val1 = 0;
                if (isNaN(val2)) val2 = 0;

                let percentage = 0;
                if (val1 !== 0) {
                    percentage = (val2 / val1) * 100;
                }
                mappedRow.push(percentage.toFixed(2));

                const key = getKey(mappedRow);
                const existingRow = existingMap.get(key);

                if (existingRow) {
                    const existingNote = existingRow[10] || "";
                    mappedRow.push(existingNote);
                    existingMap.set(key, mappedRow);
                } else {
                    mappedRow.push("");
                    existingMap.set(key, mappedRow);
                }
            }

            currentIndex = chunkEnd;

            const percent = Math.round(((currentIndex - 1) / totalRows) * 100);
            UI.updateProgress(percent, `%${percent} İşlendi`);

            if (currentIndex < rows.length) {
                requestAnimationFrame(processChunk);
            } else {
                this.finalizeProcess(existingMap, headers);
            }
        };

        processChunk();
    },

    finalizeProcess: function (dataMap, headers) {
        const finalData = Array.from(dataMap.values());

        this.state.headers = headers;
        this.state.allData = finalData;

        // Update Metadata
        const now = new Date();
        this.state.metadata.importDate = now.toLocaleString('tr-TR');

        this.state.filteredData = finalData;

        this.calculateStats();
        this.saveData();
        this.render();

        UI.toggleLoading(false);
        UI.toggleProgress(false);
        alert('İşlem tamamlandı!');
    },

    updateNote: function (row, note) {
        const noteIndex = 10;
        while (row.length <= noteIndex) {
            row.push("");
        }
        row[noteIndex] = note;
        this.saveData();
    },

    excelDateToJSDate: function (serial) {
        if (!serial || isNaN(serial) || serial < 20000) return serial;
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        const day = String(date_info.getDate()).padStart(2, '0');
        const month = String(date_info.getMonth() + 1).padStart(2, '0');
        const year = date_info.getFullYear();
        return `${day}.${month}.${year}`;
    },

    handleSearch: function (e) {
        const query = e.target.value.toLowerCase();
        this.filterData('global', query);
    },

    filterData: function (type, value) {
        this.state.filters[type] = value;
        this.state.pagination.currentPage = 1; // Reset to page 1 on filter
        this.applyFilters();
    },

    applyFilters: function () {
        this.state.filteredData = this.state.allData.filter(row => {
            // Global Search
            if (this.state.filters.global) {
                const globalMatch = row.some(cell =>
                    String(cell).toLowerCase().includes(this.state.filters.global)
                );
                if (!globalMatch) return false;
            }

            // Department Filter
            if (this.state.filters.dept) {
                // Assuming matched columns for department logic. 
                // We check if ANY of the specific columns contains the Dept string.
                // Or simply check the whole row for safety if we aren't sure of column index.
                // Given "Cabin", "Ortak Cabin", "AVI"...
                const dept = this.state.filters.dept.toLowerCase();
                const rowStr = row.join(' ').toLowerCase();

                // Specific logic for "Cabin" vs "Ortak Cabin"
                if (dept === 'cabin') {
                    // Start logic: exact match in a cell? 
                    // Let's assume there is a column that holds this value.
                    // If we just check includes, 'Ortak Cabin' includes 'Cabin'.
                    // So we should check if any cell strictly equals 'cabin' OR if we check for specific columns.
                    // For now, let's look for exact cell match in the row.
                    const hasExact = row.some(cell => String(cell).trim().toLowerCase() === dept);
                    // Also consider "Cabin" might be part of "Cabin Interior" etc.
                    // If 'Ortak Cabin' is a separate category, we want to exclude it if user selected 'Cabin'?
                    // Usually filters are inclusive.
                    // Let's stick to: Cell value must INCLUDE the search term.
                    // But if I search 'Cabin', I get 'Ortak Cabin'.
                    // If I search 'Ortak Cabin', I get 'Ortak Cabin'.
                    // User might want distinct. 
                    // Let's try exact match for Dept first.
                    // If exact match fails (e.g. data has 'AVI-1'), then we might need includes.

                    // Let's perform a smart check: 
                    // Check specific columns (e.g. index 3, 5, 6)

                    // Since I don't know the exact column, I will check if ANY cell *starts with* or *equals* the dept.
                    const match = row.some(cell => {
                        const c = String(cell).toLowerCase();
                        return c === dept || c.includes(dept);
                    });
                    if (!match) return false;
                } else {
                    // For others
                    const match = row.some(cell => String(cell).toLowerCase().includes(dept));
                    if (!match) return false;
                }
            }

            return true;
        });

        // Re-apply sort if active
        if (this.state.sort.colIndex !== -1) {
            this.sortData(this.state.sort.colIndex, false);
        } else {
            this.render();
        }

        this.calculateStats(); // Recalculate stats based on filtered data? Or all data? Usually Dashboard stats show *current view* or *overall*? 
        // "Stats Bar" usually implies global stats or filtered stats.
        // Let's show Global Stats (Total, Open, Closed) of the *whole* dataset? 
        // Or stats of the *filtered* dataset?
        // Let's assume *Global* for "Import Date", but "Open/Closed" might be useful for filtered too.
        // However, usually "Dashboard" stats at top are summary of imported file.
        // Let's stick to ALL DATA stats for the counters, so filters don't confuse the "Total loaded" context.
        // But if user filters "Cabin", they might want to know how many Open in Cabin.
        // Let's do *Filtered* stats. It's more dynamic.
        this.calculateStats();
    },

    sortData: function (colIndex, toggle = true) {
        if (toggle) {
            if (this.state.sort.colIndex === colIndex) {
                this.state.sort.asc = !this.state.sort.asc;
            } else {
                this.state.sort.colIndex = colIndex;
                this.state.sort.asc = true;
            }
        }

        const { colIndex: sortIdx, asc } = this.state.sort;

        this.state.filteredData.sort((a, b) => {
            let valA = a[sortIdx];
            let valB = b[sortIdx];

            if (sortIdx === 4) {
                const parseDate = (d) => {
                    if (!d) return 0;
                    if (typeof d === 'string' && d.includes('.')) {
                        const p = d.split('.');
                        return new Date(p[2], p[1] - 1, p[0]).getTime();
                    }
                    return 0;
                };
                return asc ? parseDate(valA) - parseDate(valB) : parseDate(valB) - parseDate(valA);
            }

            const numA = parseFloat(valA);
            const numB = parseFloat(valB);

            if (!isNaN(numA) && !isNaN(numB)) {
                return asc ? numA - numB : numB - numA;
            }

            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();

            if (strA < strB) return asc ? -1 : 1;
            if (strA > strB) return asc ? 1 : -1;
            return 0;
        });

        this.render();
    },

    changePage: function (direction) {
        const { currentPage, itemsPerPage } = this.state.pagination;
        const totalPages = Math.ceil(this.state.filteredData.length / itemsPerPage);
        const newPage = currentPage + direction;

        if (newPage >= 1 && newPage <= totalPages) {
            this.state.pagination.currentPage = newPage;
            this.render();
        }
    },

    calculateStats: function () {
        // We calculate stats on Filtered Data or All Data?
        // Let's do Filtered Data so it reflects the current view.
        // Status Column: Index 6
        const data = this.state.filteredData;
        let open = 0, closed = 0, defer = 0;

        data.forEach(row => {
            const status = String(row[6]).toUpperCase();
            if (status.includes('OPEN')) open++;
            else if (status.includes('CLOSED')) closed++;
            else if (status.includes('DEFER')) defer++;
        });

        UI.updateStats({
            open,
            closed,
            defer,
            date: this.state.metadata.importDate
        });
    },

    render: function () {
        const { currentPage, itemsPerPage } = this.state.pagination;
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;

        const pageData = this.state.filteredData.slice(start, end);
        const totalPages = Math.ceil(this.state.filteredData.length / itemsPerPage);

        UI.showData(this.state.headers, pageData, currentPage, totalPages);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
