const App = {
    state: {
        allData: [],
        filteredData: [],
        headers: [],
        filters: {},
        sort: {
            colIndex: -1,
            asc: true
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
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearData());
    },

    loadData: function () {
        const saved = Storage.load();
        if (saved) {
            this.state.allData = saved.data;
            this.state.headers = saved.headers;
            this.state.filteredData = saved.data; // Initial view
            this.render();
        }
    },

    saveData: function () {
        Storage.save({
            headers: this.state.headers,
            data: this.state.allData
        });
    },

    clearData: function () {
        if (confirm('Verileri temizlemek istediğinize emin misiniz?')) {
            Storage.clear();
            this.state.allData = [];
            this.state.filteredData = [];
            this.state.headers = [];
            this.render();
        }
    },

    handleFile: function (e) {
        const file = e.target.files[0];
        if (!file) return;

        UI.toggleLoading(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            this.processData(json);
            UI.toggleLoading(false);
        };
        reader.readAsArrayBuffer(file);
    },

    processData: function (rows) {
        if (!rows || rows.length < 2) {
            alert('Dosya boş veya geçersiz format!');
            return;
        }

        const headerRow = rows[0];
        // Selected columns indices: 0, 1, 5, 6, 12, 7, 8, 15, 16 from original
        // Assuming original file structure is consistent
        const columns = [0, 1, 5, 6, 12, 7, 8, 15, 16];

        // Extract headers
        const selectedHeader = columns.map(i => headerRow[i] || "");
        selectedHeader.push("Oran %");

        // Extract and process data
        const processedData = rows.slice(1).map(row => {
            const mappedRow = columns.map((colIdx, i) => {
                let cell = row[colIdx];
                // Handle missing values
                if (cell === undefined || cell === null) cell = "";

                // Date formatting for the 5th visual column (index 4)
                // In Excel, dates can be numbers.
                if (i === 4 && typeof cell === 'number') {
                    cell = this.excelDateToJSDate(cell);
                }
                return cell;
            });

            // Calculate Percentage (last 2 columns of selection: indices 7 and 8 in mappedRow)
            // mappedRow indices: 0..8
            // 7 -> col 15 in excel
            // 8 -> col 16 in excel
            let val1 = parseFloat(mappedRow[7]);
            let val2 = parseFloat(mappedRow[8]);

            if (isNaN(val1)) val1 = 0;
            if (isNaN(val2)) val2 = 0;

            let percentage = 0;
            if (val1 !== 0) {
                percentage = (val2 / val1) * 100;
            }
            mappedRow.push(percentage.toFixed(2));

            return mappedRow;
        });

        this.state.headers = selectedHeader;
        this.state.allData = processedData;
        this.state.filteredData = processedData;

        this.saveData();
        this.render();
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

    filterData: function (columnIndex, value) {
        if (columnIndex === 'global') {
            this.state.filters.global = value;
        } else {
            this.state.filters[columnIndex] = value;
        }
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

            // Column Filters
            for (const [colIdx, filterVal] of Object.entries(this.state.filters)) {
                if (colIdx === 'global' || filterVal === "") continue;
                if (String(row[colIdx]) !== String(filterVal)) return false;
            }

            return true;
        });

        // Re-apply sort if active
        if (this.state.sort.colIndex !== -1) {
            this.sortData(this.state.sort.colIndex, false); // false = don't toggle, just sort
        } else {
            this.render();
        }
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

            // Specific Date Sort for Index 4 (DD.MM.YYYY)
            if (sortIdx === 4) {
                const parseDate = (d) => {
                    if (!d) return 0;
                    // Check if it's already a string date DD.MM.YYYY
                    if (typeof d === 'string' && d.includes('.')) {
                        const p = d.split('.');
                        return new Date(p[2], p[1] - 1, p[0]).getTime();
                    }
                    return 0;
                };
                return asc ? parseDate(valA) - parseDate(valB) : parseDate(valB) - parseDate(valA);
            }

            // Numeric Check
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);

            if (!isNaN(numA) && !isNaN(numB)) {
                return asc ? numA - numB : numB - numA;
            }

            // String Sort
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();

            if (strA < strB) return asc ? -1 : 1;
            if (strA > strB) return asc ? 1 : -1;
            return 0;
        });

        this.render();
    },

    render: function () {
        UI.showData(this.state.headers, this.state.filteredData);
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
