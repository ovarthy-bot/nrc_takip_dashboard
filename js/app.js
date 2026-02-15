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

            // Migration: Ensure "Not" column exists
            if (!this.state.headers.includes("Not")) {
                this.state.headers.push("Not");
                // Add empty note to all rows
                this.state.allData.forEach(row => {
                    // Ensure row handles the new column index (10)
                    // Current length should be 10 (0..9). 
                    // processData pushes 9 elements (0..8) + 1 percentage = 10 elements.
                    // So we push 1 more.
                    row.push("");
                });
                this.saveData(); // Save migrated data
                console.log("Data migrated: Added 'Not' column.");
            }

            this.state.filteredData = this.state.allData; // Initial view
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
        UI.toggleProgress(true);
        UI.updateProgress(0, 'Dosya okunuyor...');

        // Short timeout to allow UI to render
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

        // 1. Prepare Headers (once)
        // If we already have headers (from previous load), keep them. 
        // But we should ensure "Not" column exists.

        let headers = this.state.headers;
        if (headers.length === 0) {
            headers = columns.map(i => headerRow[i] || "");
            headers.push("Oran %");
            headers.push("Not"); // New Note Column
        }

        // 2. Index Existing Data for Merging
        // Map: "WO_TaskCard" -> Row Object (or Array)
        // We use a Map to store references to existing rows.
        const existingMap = new Map();

        // Key generation helper
        const getKey = (row) => `${row[0]}_${row[1]}`; // WO + TaskCard

        this.state.allData.forEach(row => {
            const key = getKey(row);
            existingMap.set(key, row);
        });

        const totalRows = rows.length - 1;
        let currentIndex = 1;
        const CHUNK_SIZE = 500; // Process 500 rows at a time

        const processChunk = () => {
            const chunkEnd = Math.min(currentIndex + CHUNK_SIZE, rows.length);

            for (let i = currentIndex; i < chunkEnd; i++) {
                const row = rows[i];
                // Map to our structure
                const mappedRow = columns.map((colIdx, idx) => {
                    let cell = row[colIdx];
                    if (cell === undefined || cell === null) cell = "";

                    // Date formatting for visual column 4 (originally index 5 in columns array? No, index 4 in result array is index 12 in source? Wait.)
                    // columns = [0, 1, 5, 6, 12, ...] -> index 4 is 12?
                    // 0->0, 1->1, 2->5, 3->6, 4->12. Yes. 
                    // Wait, original code said: "if (i === 4 && typeof cell === 'number')"
                    // Let's verify mapping:
                    // 0: WO
                    // 1: Task Card
                    // 2: ?
                    // 3: ?
                    // 4: ? (Date?)
                    if (idx === 4 && typeof cell === 'number') {
                        cell = this.excelDateToJSDate(cell);
                    }
                    return cell;
                });

                // Calculate Percentage
                let val1 = parseFloat(mappedRow[7]); // Index 7 in mapped (source 15)
                let val2 = parseFloat(mappedRow[8]); // Index 8 in mapped (source 16)

                if (isNaN(val1)) val1 = 0;
                if (isNaN(val2)) val2 = 0;

                let percentage = 0;
                if (val1 !== 0) {
                    percentage = (val2 / val1) * 100;
                }
                mappedRow.push(percentage.toFixed(2)); // Index 9

                // Merge Logic
                const key = getKey(mappedRow);
                const existingRow = existingMap.get(key);

                if (existingRow) {
                    // Update existing row data BUT preserve Note
                    // Expected structure: [...data, percentage, note]
                    // existingRow might differ if we update columns, but assuming consistent schema.
                    const existingNote = existingRow[10] || ""; // Index 10 is Note
                    mappedRow.push(existingNote);

                    // Replace in Map (effectively updating the dataset definition)
                    // However, allData is an Array. We need to reconstruct it or update it in place.
                    // Since we are iterating *new* file, we might have rows in *old* data that are NOT in *new* file.
                    // The requirement says: "Import edilen veri daha önce uygulama içerisinde bulunamadıysa en sona bu veriler eklensin."
                    // And "değişen verilerin eskisi güncellensin."
                    // So we implicitly keep old rows that are NOT in the new file? 
                    // Or do we only keep the union? usually "import" implies adding/updating, not replacing whole dataset (unless it was a clean state).
                    // But if we want to update *existing* rows, we should modify the object ref if possible, or build a new list.

                    // Strategy:
                    // 1. We have `existingMap` with all current data.
                    // 2. We process new rows.
                    // 3. If match -> Update the entry in `existingMap` (preserving note).
                    // 4. If new -> Add to `existingMap` (or a separate list of new items).
                    // 5. Finally, flatten Map values to Array.

                    existingMap.set(key, mappedRow);
                } else {
                    // New Row
                    mappedRow.push(""); // Empty Note
                    existingMap.set(key, mappedRow);
                }
            }

            currentIndex = chunkEnd;

            // Update UI
            const percent = Math.round(((currentIndex - 1) / totalRows) * 100);
            UI.updateProgress(percent, `%${percent} İşlendi`);

            if (currentIndex < rows.length) {
                requestAnimationFrame(processChunk);
            } else {
                // Finished
                this.finalizeProcess(existingMap, headers);
            }
        };

        processChunk();
    },

    finalizeProcess: function (dataMap, headers) {
        // Convert Map values back to Array
        const finalData = Array.from(dataMap.values());

        this.state.headers = headers;
        this.state.allData = finalData;
        this.state.filteredData = finalData; // Reset filter on new import? Or re-apply?
        // Let's reset filter for now to show all data (or just the updated set).

        this.saveData();
        this.render();

        UI.toggleLoading(false);
        UI.toggleProgress(false);
        alert('İşlem tamamlandı!');
    },

    updateNote: function (row, note) {
        // row is a reference to the array in allData
        // We find the note column index.
        const noteIndex = 10; // Fixed based on our logic (9 cols + 1 pct + 1 note)
        // Ensure row has space
        while (row.length <= noteIndex) {
            row.push("");
        }
        row[noteIndex] = note;
        this.saveData();
        // No need to re-render entire table if just updating memory, 
        // but if search depends on it, we might need to if we were filtering by note content (not yet implemented in search though).
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
