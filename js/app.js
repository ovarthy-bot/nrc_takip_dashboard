const App = {
    state: {
        allData: [], filteredData: [], mappings: {},
        headers: [], currentPage: 1, pageSize: 50,
        lastImport: null, searchTimeout: null
    },

    init: function() {
        Storage.initFirebase();
        this.state.mappings = Storage.loadMappings();
        const saved = Storage.loadAll();
        if (saved) {
            this.state.allData = saved.data;
            this.state.lastImport = saved.timestamp;
            this.applyFilters();
        }
        this.bindEvents();
    },

    bindEvents: function() {
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFile(e));
        
        // Debounce Search
        document.getElementById('search').addEventListener('input', (e) => {
            clearTimeout(this.state.searchTimeout);
            this.state.searchTimeout = setTimeout(() => {
                this.state.currentPage = 1;
                this.applyFilters(e.target.value);
            }, 300);
        });
    },

    handleFile: function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });

            // VALIDASYON: WO ve Task Card kontrolü
            if (!json[0].includes("WO") && !json[0].includes("Work Order")) {
                alert("Hata: Geçersiz Excel formatı! Veritabanı korunması için işlem durduruldu.");
                return;
            }

            this.processDataChunked(json);
        };
        reader.readAsArrayBuffer(file);
    },

    processDataChunked: function(rows) {
        UI.toggleProgress(true);
        const newRows = [];
        const CHUNK_SIZE = 500;
        let index = 1;

        const process = () => {
            const end = Math.min(index + CHUNK_SIZE, rows.length);
            for (let i = index; i < end; i++) {
                const row = rows[i];
                const wo = String(row[0]);
                const aircraft = this.state.mappings[wo] || "Tanımsız";
                
                // [Uçak, WO, Task, ..., Not, Bölüm]
                const processedRow = [aircraft, ...row.slice(0, 9), "", "OTHER"];
                newRows.push(processedRow);
            }
            
            index = end;
            const pct = Math.round((index / rows.length) * 100);
            UI.updateProgress(pct);

            if (index < rows.length) {
                requestAnimationFrame(process);
            } else {
                this.state.allData = newRows;
                this.state.lastImport = new Date().toLocaleString();
                this.state.headers = ["Uçak", ...rows[0].slice(0, 9), "Notlar", "Bölüm"];
                Storage.saveAll(this.state.allData, this.state.lastImport);
                this.applyFilters();
                UI.toggleProgress(false);
                alert("Veriler başarıyla yüklendi.");
            }
        };
        process();
    },

    applyFilters: function(query = "") {
        const q = query.toLowerCase();
        this.state.filteredData = this.state.allData.filter(row => 
            row.some(cell => String(cell).toLowerCase().includes(q))
        );
        UI.render();
    },

    saveMapping: function() {
        const wo = document.getElementById('map-wo').value;
        const ac = document.getElementById('map-ac').value;
        if (!wo || !ac) return;
        this.state.mappings[wo] = ac;
        Storage.saveMappings(this.state.mappings);
        UI.renderMappings();
        alert("Eşleşme eklendi. Listeyi güncellemek için Excel'i tekrar yükleyin.");
    },

    switchPage: function(page) {
        document.getElementById('page-dashboard').classList.toggle('hidden', page !== 'dashboard');
        document.getElementById('page-mapping').classList.toggle('hidden', page !== 'mapping');
        document.querySelectorAll('.tab-link').forEach(btn => 
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(page === 'mapping' ? 'uçak' : 'dash'))
        );
    }
};

App.init();
