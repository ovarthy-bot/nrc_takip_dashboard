import Storage from './storage.js';
import UI from './ui.js';
import { writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


const App = {
    state: {
        allData: [],
        filteredData: [],
        headers: [],
        filters: {
            global: '',
            departments: new Set()
        },
        sort: {
            colIndex: -1,
            asc: true
        },
        pagination: {
            currentPage: 1,
            pageSize: 50,
            totalPages: 1
        },
        importDate: null
    },

    init: async function () {
        console.log('App initialized');
        UI.init();
        this.bindEvents();
        await this.loadData();
    },

    bindEvents: function () {
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFile(e));

        // Debounce Search
        const searchInput = document.getElementById('search');
        searchInput.addEventListener('input', this.debounce((e) => {
            this.filterData('global', e.target.value.toLowerCase());
        }, 300));
    },

    debounce: function (func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    loadData: async function () {
        const saved = await Storage.loadData();
        if (saved) {
            this.state.allData = saved.data;
            this.state.headers = saved.headers;
            this.state.importDate = saved.lastUpdated;
            this.applyFilters(); // Setup initial view

            if (this.state.importDate) {
                // Format date logic if needed
                this.updateStats();
            }
        }
    },

    saveData: async function (headers, dataRows) {
    try {

        // Metadata
        await setDoc(doc(db, this.COLLECTION_DATA, 'metadata'), {
            headers: headers,
            lastUpdated: new Date().toISOString()
        });

        const batch = writeBatch(db);

        dataRows.forEach(row => {
            const id = `${row[1]}_${row[2]}`.replace(/\//g, '_');
            const ref = doc(db, 'records', id);
            batch.set(ref, { data: row });
        });

        await batch.commit();

    } catch (e) {
        console.error("Error saving data:", e);
        throw e;
    }
},


    

    handleFile: function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validation for file type
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        // Some browsers might not accept mime types correctly, check extension too.
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            alert("Lütfen geçerli bir Excel dosyası (.xlsx, .xls) yükleyin.");
            return;
        }

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

                    await this.processDataChunked(json);
                } catch (err) {
                    console.error(err);
                    alert('Dosya okunurken hata oluştu! Dosya bozuk olabilir.');
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

        // Validate Headers - Check for critical columns like "WO", "Task Card" etc based on index
        // Assuming strict format? 
        // User said: "Yanlış dosya yüklenmeye çalışılırsa firebase veritabanının bozulmasını önlemek için uygulama durdurulsun."
        // We should check if we have enough columns.
        if (rows[0].length < 10) {
            alert('Hatalı dosya formatı! Sütun sayısı eksik.');
            UI.toggleLoading(false);
            UI.toggleProgress(false);
            return;
        }

        const headerRow = rows[0];
        const columns = [0, 1, 5, 6, 12, 7, 8, 15, 16];

        // Load Mappings for VLOOKUP
        const mappings = await Storage.loadMappings();

        // Prepare Headers - ADD "Uçak İsmi" at index 0
        let headers = ["Uçak İsmi"];
        columns.forEach(i => headers.push(headerRow[i] || ""));
        headers.push("Oran %");
        headers.push("Bölüm"); // New Department Column
        headers.push("Not");   // Note moved to end

        // Merge Logic
        const newRows = [];
        const totalRows = rows.length - 1;
        let currentIndex = 1;
        const CHUNK_SIZE = 1000;

        const processChunk = async () => {
            const chunkEnd = Math.min(currentIndex + CHUNK_SIZE, rows.length);

            for (let i = currentIndex; i < chunkEnd; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                const mappedRow = [];

                // 1. Get WO for VLOOKUP
                const wo = row[0]; // Assuming WO is at index 0 of Source
                const aircraftName = mappings[wo] || "";
                mappedRow.push(aircraftName); // Index 0 in App Data

                // 2. Map other columns
                columns.forEach((colIdx, idx) => {
                    let cell = row[colIdx];
                    if (cell === undefined || cell === null) cell = "";
                    // Date fix for column 4 (Source index 12)
                    if (idx === 4 && typeof cell === 'number') {
                        cell = this.excelDateToJSDate(cell);
                    }
                    mappedRow.push(cell);
                });

                // 3. Calc Percentage
                // Source indices 15 and 16 correspond to mapped indices:
                // [Uçak, 0, 1, 5, 6, 12, 7, 8, 15, 16]
                // 0->1, 1->2 ...
                // 15 is at index 7+1 = 8? 
                // headers: [Ucak, WO, Task, ..., val1, val2, ...]
                // columns: [0, 1, 5, 6, 12, 7, 8, 15, 16]
                // mappedRow (value): [Air, col0, col1, col5, col6, col12, col7, col8, col15, col16]
                // Indices in mappedRow:
                // Air: 0
                // col0: 1
                // col15: 8
                // col16: 9

                let val1 = parseFloat(mappedRow[8]);
                let val2 = parseFloat(mappedRow[9]);
                if (isNaN(val1)) val1 = 0;
                if (isNaN(val2)) val2 = 0;
                let percentage = val1 !== 0 ? (val2 / val1) * 100 : 0;
                mappedRow.push(percentage.toFixed(2));

                // 4. Department (Empty default)
                mappedRow.push("");

                // 5. Note (Empty default)
                mappedRow.push("");

                newRows.push(mappedRow);
            }

            currentIndex = chunkEnd;
            UI.updateProgress(Math.round(((currentIndex - 1) / totalRows) * 100), `%${Math.round(((currentIndex - 1) / totalRows) * 100)} İçe Aktarılıyor`);

            if (currentIndex < rows.length) {
                setTimeout(processChunk, 0);
            } else {
                // Here we should merge with existing notes and departments if any?
                const existingData = this.state.allData;
                const metaMap = new Map(); // Store {note, dept}
                const existingNoteIdx = this.state.headers.indexOf("Not");
                const existingDeptIdx = this.state.headers.indexOf("Bölüm");

                existingData.forEach(r => {
                    const key = `${r[1]}_${r[2]}`; // WO_TaskCard
                    const note = existingNoteIdx !== -1 ? r[existingNoteIdx] : "";
                    const dept = existingDeptIdx !== -1 ? r[existingDeptIdx] : "";
                    metaMap.set(key, { note: note, dept: dept });
                });

                // Apply to newRows
                const newNoteIdx = headers.indexOf("Not");
                const newDeptIdx = headers.indexOf("Bölüm");

                newRows.forEach(r => {
                    const key = `${r[1]}_${r[2]}`; // WO_TaskCard
                    if (metaMap.has(key)) {
                        const meta = metaMap.get(key);
                        if (newNoteIdx !== -1) r[newNoteIdx] = meta.note || "";
                        if (newDeptIdx !== -1) r[newDeptIdx] = meta.dept || "";
                    }
                });

                this.state.headers = headers;
                this.state.allData = newRows;
                this.state.importDate = new Date().toLocaleString('tr-TR');

                await this.saveData(); // Save to Firebase
                this.applyFilters();

                UI.toggleLoading(false);
                UI.toggleProgress(false);
                UI.updateStats({
                    open: 0,
                    closed: 0,
                    defer: 0,
                    date: this.state.importDate
                }); // Will be recalculated in applyFilters
                alert('Veriler başarıyla yüklendi ve Firebase\'e kaydedildi.');
            }
        };

        processChunk();
    },

    updateNote: function (row, note) {
        // Update in memory
        const noteIdx = this.state.headers.indexOf("Not");
        if (noteIdx !== -1) {
            row[noteIdx] = note;
            Storage.saveRow(row);
        }
    },

    updateRowDepartment: function (row, dept) {
        // Toggle logic: dept is a string (e.g. "Cabin")
        // Stored as comma separated string "Cabin,AVI"
        const deptIdx = this.state.headers.indexOf("Bölüm");
        if (deptIdx === -1) return;

        let current = row[deptIdx] ? String(row[deptIdx]).split(',') : [];
        if (current.includes(dept)) {
            current = current.filter(d => d !== dept);
        } else {
            current.push(dept);
        }

        row[deptIdx] = current.join(',');
        Storage.saveRow(row);
        // Force re-render of this specific card? Or whole view?
        // Since it might affect filters, we should re-apply filters if active.
        // But for UX responsiveness, let UI handle visual toggle, and we verify filter.
        if (this.state.filters.departments.size > 0) {
            this.applyFilters();
        }
    },

    changePage: function (delta) {
        const next = this.state.pagination.currentPage + delta;
        if (next >= 1 && next <= this.state.pagination.totalPages) {
            this.state.pagination.currentPage = next;
            this.render();
        }
    },

    toggleDepartmentFilter: function (dept) {
        if (this.state.filters.departments.has(dept)) {
            this.state.filters.departments.delete(dept);
        } else {
            this.state.filters.departments.add(dept);
        }
        this.applyFilters();
    },

    filterData: function (colIndex, value) {
        if (colIndex === 'global') {
            this.state.filters.global = value;
        } else {
            this.state.filters[colIndex] = value;
        }
        this.state.pagination.currentPage = 1; // Reset to page 1
        this.applyFilters();
    },

    applyFilters: function () {
        // 1. Filter
        const globalFilter = this.state.filters.global;
        const deptFilters = this.state.filters.departments;
        // Filters definition: { colIndex: value }

        this.state.filteredData = this.state.allData.filter(row => {
            // Global Search
            if (globalFilter) {
                const globalMatch = row.some(cell =>
                    String(cell).toLowerCase().includes(globalFilter)
                );
                if (!globalMatch) return false;
            }

            // Department Filter (Logic: Matches any selected? Or implicit column?)
            // Requirement: "Not özelliği nün üst tarafına Bölüm isminde sekme eklensin... Checkbox mantığı"
            // Wait, does "Bölüm" map to a column? Or is it a Tag user applies?
            // "Kullanıcı isteğine göre butonlara basıldığında seçili kalsın. Checkbox mantığı yani. Bu veriler için filtre ekle"
            // This implies the USER sets these departments.
            // Oh! It's a tagging feature? "Not özelliğinin üst tarafına..."
            // If it's a tagging feature, we need to store it. 
            // Previous implementation had just "Not".
            // Implementation Plan: "Handle Department tagging interpretation and storage."
            // So we need another column for "Department" or combine with Note?
            // Let's add a "Department" column BEFORE "Not".

            // NOTE: I missed adding "Department" column in `processDataChunked`. 
            // I should fix that or handle it dynamically.
            // Let's assume it's stored in a column named "Bölüm".

            // RE-READ: "Not özelliğinin üst tarafına... seçim butonları eklensin"
            // This sounds like input controls in the Card View (or row expansion).
            // Meaning: User TAGS a row as 'Cabin'.
            // So we need to store this tag.

            if (deptFilters.size > 0) {
                const deptIdx = this.state.headers.indexOf("Bölüm");
                if (deptIdx !== -1) {
                    const rowDepts = row[deptIdx] ? String(row[deptIdx]).split(',') : [];
                    // Check if row has ANY of the selected filters
                    const hasMatch = [...deptFilters].some(filter => rowDepts.includes(filter));
                    if (!hasMatch) return false;
                }
            }

            // Specific Column Filters
            for (const key in this.state.filters) {
                if (key === 'global' || key === 'departments') continue;
                if (!this.state.filters[key]) continue;
                if (String(row[key]) !== String(this.state.filters[key])) return false;
            }

            return true;
        });

        // 2. Sort
        if (this.state.sort.colIndex !== -1) {
            // ... sort logic ...
            const { colIndex: sortIdx, asc } = this.state.sort;
            this.state.filteredData.sort((a, b) => {
                // ... comparisons ...
                let valA = a[sortIdx];
                let valB = b[sortIdx];
                // numeric/date/string compare
                // (simplified for brevity)
                if (valA < valB) return asc ? -1 : 1;
                if (valA > valB) return asc ? 1 : -1;
                return 0;
            });
        }

        // 3. Stats Calculation on Filtered Data (or All Data? Usually All Data or current view?)
        // "Sayfanın üst bölümüne OPEN... istatistiği gösterilsin"
        // Usually stats reflect the current filter? Or global?
        // Let's do Global stats for now as it's often more useful to see total workload.
        // Or Filtered. Let's do Filtered.
        const stats = {
            open: 0,
            closed: 0,
            defer: 0,
            date: this.state.importDate
        };

        // Find Status Column Index (Scanning headers or row[..])
        // Status usually "OPEN", "CLOSED".
        // Headers we built: [Ucak, WO, Task, ..., Status(index?), ...]
        // Columns map: [0, 1, 5, 6, ...] -> 6 comes from source.
        // Source 6 is Status? 
        // In processDataChunked: [Ucak, col0, col1, col5, col6...]
        // So Status is index 4.
        const statusIdx = 4; // Check logic: 0=Ucak, 1=WO, 2=Task, 3=col5, 4=col6(Status)

        this.state.filteredData.forEach(row => {
            const status = String(row[statusIdx]).toUpperCase();
            if (status.includes('OPEN')) stats.open++;
            else if (status.includes('CLOSED')) stats.closed++;
            else if (status.includes('DEFER')) stats.defer++;
        });
        UI.updateStats(stats);

        // 4. Update Pagination
        this.state.pagination.totalPages = Math.ceil(this.state.filteredData.length / this.state.pagination.pageSize);
        this.state.pagination.currentPage = 1;

        this.render();
    },

    render: function () {
        const { currentPage, pageSize } = this.state.pagination;
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageData = this.state.filteredData.slice(start, end);

        UI.showData(this.state.headers, this.state.filteredData, pageData);
        UI.updatePagination(currentPage, this.state.pagination.totalPages);
    },

    // Helper
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

    getUniqueValues: function (colIndex) {
        return [...new Set(this.state.allData.map(row => row[colIndex]))];
    },

    sortData: function (colIndex) {
        if (this.state.sort.colIndex === colIndex) {
            this.state.sort.asc = !this.state.sort.asc;
        } else {
            this.state.sort.colIndex = colIndex;
            this.state.sort.asc = true;
        }
        this.applyFilters(); // Re-sort and render
    }
};

export default App;
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
window.App = App; // For inline onclick handlers in generated HTML
