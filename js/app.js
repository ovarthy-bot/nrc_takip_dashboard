// Main Application Logic with Firebase, Pagination, Debouncing, and Filters
import Storage from './storage.js';
import UI from './ui.js';

const App = {
    state: {
        allData: [],
        filteredData: [],
        headers: [],
        aircraftMapping: {}, // WO -> Aircraft Name
        filters: {
            global: '',
            aircraft: '',
            departments: [] // Selected departments
        },
        sort: {
            colIndex: -1,
            asc: true
        },
        pagination: {
            currentPage: 1,
            itemsPerPage: 100,
            totalPages: 1
        },
        stats: {
            open: 0,
            closed: 0,
            defer: 0
        },
        lastImportTime: null
    },

    init: async function () {
        console.log('App initialized');
        this.bindEvents();
        await this.loadData();
    },

    bindEvents: function () {
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFile(e));

        // Debounced search (300ms delay)
        let searchTimeout;
        document.getElementById('search').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.handleSearch(e), 300);
        });

        // Aircraft filter
        document.getElementById('aircraft-filter').addEventListener('change', (e) => {
            this.filterData('aircraft', e.target.value);
        });

        // Department checkboxes
        document.querySelectorAll('.dept-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.handleDepartmentFilter());
        });

        // Pagination controls
        document.getElementById('prev-page').addEventListener('click', () => this.changePage(-1));
        document.getElementById('next-page').addEventListener('click', () => this.changePage(1));
        document.getElementById('items-per-page').addEventListener('change', (e) => {
            this.state.pagination.itemsPerPage = parseInt(e.target.value);
            this.state.pagination.currentPage = 1;
            this.render();
        });
    },

    loadData: async function () {
        UI.toggleLoading(true);

        // Load main data
        const saved = await Storage.load();
        if (saved) {
            this.state.allData = saved.data;
            this.state.headers = saved.headers;

            // Migration: Ensure required columns exist
            if (!this.state.headers.includes("Not")) {
                this.state.headers.push("Not");
                this.state.allData.forEach(row => {
                    row.push("");
                });
                await this.saveData();
                console.log("Data migrated: Added 'Not' column.");
            }

            // Ensure Aircraft Name column exists (index 0)
            if (!this.state.headers.includes("Uçak İsmi")) {
                this.state.headers.unshift("Uçak İsmi");
                this.state.allData.forEach(row => {
                    row.unshift("");
                });
                await this.saveData();
                console.log("Data migrated: Added 'Uçak İsmi' column.");
            }

            // Ensure Department column exists
            if (!this.state.headers.includes("Bölüm")) {
                // Insert after Aircraft Name (index 1)
                this.state.headers.splice(1, 0, "Bölüm");
                this.state.allData.forEach(row => {
                    row.splice(1, 0, "");
                });
                await this.saveData();
                console.log("Data migrated: Added 'Bölüm' column.");
            }
        }

        // Load aircraft mapping
        this.state.aircraftMapping = await Storage.loadMapping();

        // Apply aircraft mapping to data
        this.applyAircraftMapping();

        // Load metadata (import time, stats)
        const metadata = await Storage.loadMetadata();
        if (metadata) {
            this.state.lastImportTime = metadata.importTime;
        }

        this.state.filteredData = this.state.allData;
        this.calculateStats();
        this.render();
        UI.toggleLoading(false);
    },

    saveData: async function () {
        await Storage.save({
            headers: this.state.headers,
            data: this.state.allData
        });
    },

    applyAircraftMapping: function () {
        // Apply aircraft names based on WO number
        // WO is at index 1 (after Aircraft Name column)
        this.state.allData.forEach(row => {
            const wo = row[1]; // WO column
            if (wo && this.state.aircraftMapping[wo]) {
                row[0] = this.state.aircraftMapping[wo]; // Set Aircraft Name
            }
        });
    },

    validateExcelFile: function (json) {
        // Validate Excel file structure
        if (!json || json.length < 2) {
            throw new Error('Dosya boş veya geçersiz format!');
        }

        const headerRow = json[0];
        const requiredColumns = [0, 1, 5, 6, 7, 8, 12, 15, 16]; // Required column indices

        // Check if all required columns exist
        for (const colIdx of requiredColumns) {
            if (colIdx >= headerRow.length) {
                throw new Error(`Geçersiz dosya yapısı! Beklenen sütun sayısı: ${Math.max(...requiredColumns) + 1}, Bulunan: ${headerRow.length}`);
            }
        }

        return true;
    },

    handleFile: function (e) {
        const file = e.target.files[0];
        if (!file) return;

        UI.toggleLoading(true);
        UI.toggleProgress(true);
        UI.updateProgress(0, 'Dosya okunuyor...');

        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    // Validate file structure
                    this.validateExcelFile(json);

                    await this.processDataChunked(json);
                } catch (err) {
                    console.error(err);
                    alert('Dosya işlenirken hata oluştu: ' + err.message);
                    UI.toggleLoading(false);
                    UI.toggleProgress(false);
                }
            };
            reader.readAsArrayBuffer(file);
        }, 100);
    },

    processDataChunked: async function (rows) {
        const headerRow = rows[0];
        const columns = [0, 1, 5, 6, 12, 7, 8, 15, 16]; // Indices to keep

        // Prepare Headers
        let headers = ["Uçak İsmi", "Bölüm"]; // First two columns
        headers = headers.concat(columns.map(i => headerRow[i] || ""));
        headers.push("Oran %");
        headers.push("Not");

        // Index Existing Data for Merging
        const existingMap = new Map();
        const getKey = (row) => `${row[2]}_${row[3]}`; // WO + TaskCard (adjusted for new columns)

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

                // Map to our structure
                const mappedRow = columns.map((colIdx, idx) => {
                    let cell = row[colIdx];
                    if (cell === undefined || cell === null) cell = "";

                    // Date formatting for column index 4 in mapped data
                    if (idx === 4 && typeof cell === 'number') {
                        cell = this.excelDateToJSDate(cell);
                    }
                    return cell;
                });

                // Calculate Percentage
                let val1 = parseFloat(mappedRow[7]);
                let val2 = parseFloat(mappedRow[8]);

                if (isNaN(val1)) val1 = 0;
                if (isNaN(val2)) val2 = 0;

                let percentage = 0;
                if (val1 !== 0) {
                    percentage = (val2 / val1) * 100;
                }
                mappedRow.push(percentage.toFixed(2));

                // Add Aircraft Name and Department at the beginning
                const wo = mappedRow[0]; // WO is first in mappedRow
                const aircraftName = this.state.aircraftMapping[wo] || "";
                const department = ""; // Will be set by user

                const finalRow = [aircraftName, department, ...mappedRow];

                // Merge Logic
                const key = getKey(finalRow);
                const existingRow = existingMap.get(key);

                if (existingRow) {
                    // Update existing row BUT preserve Note and Department
                    const existingNote = existingRow[existingRow.length - 1] || "";
                    const existingDept = existingRow[1] || "";
                    finalRow[1] = existingDept; // Preserve department
                    finalRow.push(existingNote);
                    existingMap.set(key, finalRow);
                } else {
                    // New Row
                    finalRow.push(""); // Empty Note
                    existingMap.set(key, finalRow);
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

    finalizeProcess: async function (dataMap, headers) {
        const finalData = Array.from(dataMap.values());

        this.state.headers = headers;
        this.state.allData = finalData;
        this.state.filteredData = finalData;
        this.state.lastImportTime = new Date().toISOString();

        // Save to Firebase
        await this.saveData();
        await Storage.saveMetadata({
            importTime: this.state.lastImportTime
        });

        this.calculateStats();
        this.populateAircraftFilter();
        this.render();

        UI.toggleLoading(false);
        UI.toggleProgress(false);
        alert('İşlem tamamlandı!');
    },

    updateNote: async function (row, note) {
        const noteIndex = row.length - 1;
        row[noteIndex] = note;
        await this.saveData();
    },

    updateDepartment: async function (row, department) {
        row[1] = department; // Department is at index 1
        await this.saveData();
        this.applyFilters(); // Re-apply filters
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

    handleDepartmentFilter: function () {
        const selected = [];
        document.querySelectorAll('.dept-checkbox:checked').forEach(cb => {
            selected.push(cb.value);
        });
        this.state.filters.departments = selected;
        this.applyFilters();
    },

    filterData: function (filterType, value) {
        if (filterType === 'global') {
            this.state.filters.global = value;
        } else if (filterType === 'aircraft') {
            this.state.filters.aircraft = value;
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

            // Aircraft Filter
            if (this.state.filters.aircraft && row[0] !== this.state.filters.aircraft) {
                return false;
            }

            // Department Filter
            if (this.state.filters.departments.length > 0) {
                if (!this.state.filters.departments.includes(row[1])) {
                    return false;
                }
            }

            return true;
        });

        // Reset to page 1 when filters change
        this.state.pagination.currentPage = 1;

        // Re-apply sort if active
        if (this.state.sort.colIndex !== -1) {
            this.sortData(this.state.sort.colIndex, false);
        } else {
            this.calculateStats();
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

            // Date Sort for Index 6 (adjusted for new columns)
            if (sortIdx === 6) {
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

    calculateStats: function () {
        // Status column is at index 8 (adjusted for new columns)
        const statusIndex = 8;

        this.state.stats.open = 0;
        this.state.stats.closed = 0;
        this.state.stats.defer = 0;

        this.state.filteredData.forEach(row => {
            const status = String(row[statusIndex]).toUpperCase();
            if (status.includes('OPEN')) {
                this.state.stats.open++;
            } else if (status.includes('CLOSED')) {
                this.state.stats.closed++;
            } else if (status.includes('DEFER')) {
                this.state.stats.defer++;
            }
        });
    },

    populateAircraftFilter: function () {
        const select = document.getElementById('aircraft-filter');
        const unique = [...new Set(this.state.allData.map(row => row[0]))].filter(v => v).sort();

        select.innerHTML = '<option value="">Tümü</option>';
        unique.forEach(aircraft => {
            const opt = document.createElement('option');
            opt.value = aircraft;
            opt.textContent = aircraft;
            select.appendChild(opt);
        });
    },

    changePage: function (direction) {
        const newPage = this.state.pagination.currentPage + direction;
        if (newPage >= 1 && newPage <= this.state.pagination.totalPages) {
            this.state.pagination.currentPage = newPage;
            this.render();
        }
    },

    render: function () {
        // Calculate pagination
        const { itemsPerPage, currentPage } = this.state.pagination;
        const totalItems = this.state.filteredData.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        this.state.pagination.totalPages = totalPages;

        // Get current page data
        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const pageData = this.state.filteredData.slice(startIdx, endIdx);

        UI.showData(this.state.headers, pageData, this.state.stats, this.state.lastImportTime, this.state.pagination);
    }
};

// Export App for use in UI
window.App = App;

// Start App
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

export default App;
