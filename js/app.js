import Storage from './storage.js';
import UI from './ui.js';

const App = {
    state: {
        allData: [],
        filteredData: [],
        headers: [], // Headers are now fixed or derived from connection, but we keep structure
        filters: {},
        sort: {
            colIndex: -1,
            asc: true
        }
    },

    init: async function () {
        console.log('App initialized (Firebase)');
        this.bindEvents();
        await this.loadData();
    },

    bindEvents: function () {
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFile(e));
        document.getElementById('search').addEventListener('input', (e) => this.handleSearch(e));
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearData());
    },

    loadData: async function () {
        UI.toggleLoading(true);
        const data = await Storage.fetchAll();

        if (data && data.length > 0) {
            this.state.allData = data;

            // Reconstruct Headers (Assumption: all rows share same structure)
            // If data is empty, we wait for import. 
            // We hardcode headers to be safe or pick from first row if valid.
            // Based on previous logic, we know the columns.
            this.state.headers = ["WO", "Task Card", "Konu", "Ucak Tipi", "Tarih", "Bolge", "Durum", "Planlanan(MH)", "Gerceklesenn(MH)", "Oran %", "Not"];

            this.state.filteredData = data;
            this.render();
        } else {
            this.state.allData = [];
            this.state.filteredData = [];
            this.render();
        }
        UI.toggleLoading(false);
    },

    saveData: async function () {
        // With Firestore, we save individually or in batches during import/update.
        // Global "Save everything" is not efficient or needed here.
        console.log("Auto-save is handled by specific actions (Import/Update)");
    },

    clearData: function () {
        alert("Firestore üzerinden veri silme işlemi şu an devre dışı (Admin yetkisi gerektirir).");
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

    processDataChunked: async function (rows) {
        if (!rows || rows.length < 2) {
            alert('Dosya boş veya geçersiz format!');
            UI.toggleLoading(false);
            UI.toggleProgress(false);
            return;
        }

        const headerRow = rows[0];
        const columns = [0, 1, 5, 6, 12, 7, 8, 15, 16]; // Indices to keep

        // 1. Prepare Data for Batch Save
        // We will process all rows locally to format them, then send to Storage.saveBatch
        const totalRows = rows.length - 1;

        // This array will hold the NEW or UPDATED objects
        // In Firestore logic, we just send the row data.
        // The merging logic happens in Storage.saveBatch (using merge: true)? 
        // Wait, current Storage.saveBatch uses set({row: row}, {merge:true}). 
        // NOTE: set with merge: true merges fields. 
        // If we send `row: [a,b,c]`, it REPLACES the `row` field in the document.
        // It does NOT merge the array contents.
        // So we MUST preserve the Note column LOCALLY before sending if we want to keep it.
        // OR we need to fetch existing data first?
        // We already have `this.state.allData` loaded! 

        // Let's use the local state to merge Notes, then send the FULL row to Firestore.

        const existingMap = new Map();
        this.state.allData.forEach(row => {
            const key = `${row[0]}_${row[1]}`;
            existingMap.set(key, row);
        });

        const rowsToSave = [];

        // Chunk processing loop for UI responsiveness (still useful for local processing)
        // But for Firestore, we'll collect everything then batch send.

        let processedCount = 0;

        // We do this in a non-async loop for speed, then async save
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const mappedRow = columns.map((colIdx, idx) => {
                let cell = row[colIdx];
                if (cell === undefined || cell === null) cell = "";
                if (idx === 4 && typeof cell === 'number') {
                    cell = this.excelDateToJSDate(cell);
                }
                return cell;
            });

            // Percentage
            let val1 = parseFloat(mappedRow[7]);
            let val2 = parseFloat(mappedRow[8]);

            if (isNaN(val1)) val1 = 0;
            if (isNaN(val2)) val2 = 0;

            let percentage = 0;
            if (val1 !== 0) {
                percentage = (val2 / val1) * 100;
            }
            mappedRow.push(percentage.toFixed(2));

            // Merge Logic
            const key = `${mappedRow[0]}_${mappedRow[1]}`;
            const existingRow = existingMap.get(key);

            if (existingRow) {
                const existingNote = existingRow[10] || ""; // Index 10 is Note
                mappedRow.push(existingNote);
            } else {
                mappedRow.push(""); // Empty Note
            }

            rowsToSave.push(mappedRow);
        }

        // Now we have rowsToSave. Send to Firestore.
        // We can do this with progress updates.

        UI.updateProgress(50, 'Veriler hazırlanıyor...');

        await Storage.saveBatch(rowsToSave); // This implementation should handle chunking internally or we do it here.
        // My Storage implementation handles batching.

        UI.updateProgress(100, 'Tamamlandı');

        // Reload fresh data
        await this.loadData();

        alert('İşlem tamamlandı!');
        UI.toggleProgress(false);
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

    updateNote: async function (row, note) {
        // Update local state first for responsiveness
        const noteIndex = 10;
        while (row.length <= noteIndex) row.push("");
        row[noteIndex] = note;

        // Send to Firestore
        await Storage.updateRow(row);
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

// Export and Attach to Window
window.App = App;
export default App;

// Start App
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
