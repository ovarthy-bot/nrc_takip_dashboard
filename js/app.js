import Storage from './storage.js';
import UI from './ui.js';

const App = {
    state: {
        allData: [],
        filteredData: [],
        headers: [],
        filters: {},
        sort: {
            colIndex: -1,
            asc: true
        },
        pagination: {
            pageSize: 50,
            currentPage: 1
        },
        aircraftMap: {}, // WO -> Plane Name
        meta: {} // Last Import time etc.
    },

    init: async function () {
        console.log('App initialized (Firebase + Opts)');
        this.bindEvents();
        await this.loadData();
    },

    bindEvents: function () {
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFile(e));
        document.getElementById('search').addEventListener('input', this.debounce((e) => this.handleSearch(e), 300));

        // Aircraft Map Modal
        document.getElementById('aircraftMapBtn').addEventListener('click', () => {
            UI.renderMapList(this.state.aircraftMap);
            UI.openModal();
        });
        document.querySelector('.close-modal').addEventListener('click', () => UI.closeModal());
        document.getElementById('save-map-btn').addEventListener('click', () => this.saveAircraftMapping());

        // Dept Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterData('dept', e.target.dataset.dept);
            });
        });

        // Pagination
        // (Handled in UI.renderPagination callbacks, creating global access)
    },

    // Utility: Debounce
    debounce: function (func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    loadData: async function () {
        UI.toggleLoading(true);

        // Parallel Fetch
        const [data, map, meta] = await Promise.all([
            Storage.fetchAll(),
            Storage.fetchAircraftMap(),
            Storage.getMetadata()
        ]);

        this.state.aircraftMap = map || {};
        this.state.meta = meta || {};
        UI.updateLastImport(this.state.meta.timestamp);

        if (data && data.length > 0) {
            this.state.allData = data;
            this.state.headers = ["WO", "Task Card", "Konu", "Ucak Tipi", "Tarih", "Bolge", "Durum", "Planlanan(MH)", "Gerceklesenn(MH)", "Oran %", "Not"];

            // Check for Department Column existence in logic?
            // "Bolge" is index 5. We use this for tabs.

            this.state.filteredData = data;
            this.calculateStats();
            this.render();
        } else {
            this.state.allData = [];
            this.state.filteredData = [];
            this.render();
        }
        UI.toggleLoading(false);
    },

    calculateStats: function () {
        // Stats: OPEN, CLOSED, DEFER based on "Durum" (Index 6)
        let open = 0, closed = 0, defer = 0;
        this.state.allData.forEach(row => {
            const status = String(row[6]).toUpperCase();
            if (status.includes('OPEN')) open++;
            else if (status.includes('CLOSED')) closed++;
            else if (status.includes('DEFER')) defer++;
        });
        UI.updateStats(open, closed, defer);
    },

    saveAircraftMapping: async function () {
        const woInput = document.getElementById('map-wo');
        const planeInput = document.getElementById('map-plane');
        const wo = woInput.value.trim();
        const plane = planeInput.value.trim();

        if (!wo || !plane) return alert('Lütfen bilgileri giriniz.');

        await Storage.saveAircraftMap(wo, plane);
        this.state.aircraftMap[wo] = plane; // Update local

        woInput.value = '';
        planeInput.value = '';
        UI.renderMapList(this.state.aircraftMap);
        this.render(); // Re-render table to show new plane names
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

    processDataChunked: async function (rows) {
        if (!rows || rows.length < 2) {
            alert('Dosya boş veya geçersiz format!');
            UI.toggleLoading(false);
            UI.toggleProgress(false);
            return;
        }

        const headerRow = rows[0];
        // Validation: Check if critical columns exist
        // Expected: WO(0), TaskCard(1), Status(6) at least?
        // We rely on index. Simple check: length > 10?
        if (rows[0].length < 10) {
            alert('Hatalı Format: Eksik sütunlar. Lütfen doğru Excel dosyasını yükleyin.');
            UI.toggleLoading(false);
            UI.toggleProgress(false);
            return;
        }

        const columns = [0, 1, 5, 6, 12, 7, 8, 15, 16]; // Indices to keep

        // 1. Prepare Data for Batch Save
        const existingMap = new Map();
        this.state.allData.forEach(row => {
            const key = `${row[0]}_${row[1]}`;
            existingMap.set(key, row);
        });

        const rowsToSave = [];

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

        UI.updateProgress(50, 'Veriler hazırlanıyor...');

        await Storage.saveBatch(rowsToSave);

        // Save Metadata
        const now = new Date().toLocaleString('tr-TR');
        await Storage.saveMetadata({ timestamp: now });
        UI.updateLastImport(now);

        UI.updateProgress(100, 'Tamamlandı');

        // Optimized Update: Don't fetchAgain. Use rowsToSave.
        this.state.allData = rowsToSave;
        this.state.filteredData = rowsToSave;
        this.calculateStats();
        this.render();

        alert('İşlem tamamlandı!');
        UI.toggleProgress(false);
        UI.toggleLoading(false);
    },

    updateNote: async function (row, note) {
        const noteIndex = 10;
        while (row.length <= noteIndex) row.push("");
        row[noteIndex] = note;
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

    filterData: function (type, value) {
        this.state.pagination.currentPage = 1; // Reset to page 1 on filter

        if (type === 'global') {
            this.state.filters.global = value;
        } else if (type === 'dept') {
            this.state.filters.dept = value;
        } else {
            this.state.filters[type] = value;
        }
        this.applyFilters();
    },

    applyFilters: function () {
        this.state.filteredData = this.state.allData.filter(row => {
            // Global Search
            if (this.state.filters.global) {
                const globalMatch = row.some((cell, i) => {
                    // Check visible data + Note (Index 10)
                    // Also check mapped Aircraft Name?
                    if (i === 0) { // Check WO and Aircraft Name
                        const plane = this.state.aircraftMap[cell] || "";
                        if (String(plane).toLowerCase().includes(this.state.filters.global)) return true;
                    }
                    return String(cell).toLowerCase().includes(this.state.filters.global);
                });
                if (!globalMatch) return false;
            }

            // Department Filter (Index 5: Bolge)
            if (this.state.filters.dept) {
                const rowDept = String(row[5]).toUpperCase();
                const filterDept = this.state.filters.dept;
                // Strict equality or contains? Usually distinct values.
                if (rowDept !== filterDept) return false;
            }

            // Other filters
            for (const [colIdx, filterVal] of Object.entries(this.state.filters)) {
                if (['global', 'dept'].includes(colIdx) || filterVal === "") continue;
                if (String(row[colIdx]) !== String(filterVal)) return false;
            }

            return true;
        });

        if (this.state.sort.colIndex !== -1) {
            this.sortData(this.state.sort.colIndex, false);
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

        // Optimization: Sort entire dataset or just filtered?
        // We must sort filtered data.
        // Pagination applies AFTER sort.

        this.state.filteredData.sort((a, b) => {
            let valA = a[sortIdx];
            let valB = b[sortIdx];

            // Date Sort (Index 4)
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

    changePage: function (page) {
        if (page < 1) return;
        const totalPages = Math.ceil(this.state.filteredData.length / this.state.pagination.pageSize);
        if (page > totalPages) return;

        this.state.pagination.currentPage = page;
        this.render();
    },

    render: function () {
        // Pagination Logic
        const { currentPage, pageSize } = this.state.pagination;
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageData = this.state.filteredData.slice(start, end);

        const totalItems = this.state.filteredData.length;
        const totalPages = Math.ceil(totalItems / pageSize);

        UI.showData(this.state.headers, pageData, {
            currentPage,
            totalPages,
            totalItems
        });
    }
};

window.App = App;
export default App;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
