const App = {
    state: {
        allData: [], filteredData: [], mappings: {},
        currentPage: 1, pageSize: 50,
        searchQuery: '', activeView: 'dashboard',
        lastImport: null
    },

    init: function() {
        this.state.mappings = Storage.loadMappings();
        const saved = Storage.loadData();
        if(saved) {
            this.state.allData = saved.data;
            this.state.lastImport = saved.timestamp;
            this.applyFilters();
        }
        this.bindEvents();
        UI.renderMappings(this.state.mappings);
    },

    bindEvents: function() {
        // Debounce Search
        const searchInput = document.getElementById('search');
        searchInput.addEventListener('input', this.debounce(() => {
            this.state.searchQuery = searchInput.value.toLowerCase();
            this.state.currentPage = 1;
            this.applyFilters();
        }, 300));

        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFile(e));
        
        // Mobile Filter Events
        document.getElementById('filter-aircraft').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-dept').addEventListener('change', () => this.applyFilters());
    },

    debounce: (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    },

    handleFile: function(e) {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
            
            // Güvenlik: Yanlış dosya kontrolü
            if(!json[0].includes("WO") && !json[0].includes("Work Order")) {
                alert("Hatalı Dosya Formtı! İşlem durduruldu.");
                return;
            }

            this.processData(json);
        };
        reader.readAsArrayBuffer(file);
    },

    processData: function(rows) {
        const processed = rows.slice(1).map(row => {
            // VLOOKUP mantığı: WO row[0]'da ise
            const wo = String(row[0]);
            const aircraft = this.state.mappings[wo] || "Bilinmiyor";
            return [aircraft, ...row, "OTHER"]; // Uçak İsmi + Veri + Başlangıç Bölümü
        });

        this.state.allData = processed;
        this.state.lastImport = new Date().toLocaleString('tr-TR');
        Storage.saveData({data: processed, timestamp: this.state.lastImport});
        this.applyFilters();
    },

    applyFilters: function() {
        const acFilter = document.getElementById('filter-aircraft').value;
        const deptFilter = document.getElementById('filter-dept').value;

        this.state.filteredData = this.state.allData.filter(row => {
            const matchesSearch = row.some(cell => String(cell).toLowerCase().includes(this.state.searchQuery));
            const matchesAC = acFilter === "" || row[0] === acFilter;
            const matchesDept = deptFilter === "" || row[row.length - 1] === deptFilter;
            return matchesSearch && matchesAC && matchesDept;
        });

        UI.render(this.state.filteredData);
        UI.updateStats(this.state.filteredData);
    },

    addMapping: function() {
        const wo = document.getElementById('map-wo').value;
        const ac = document.getElementById('map-ac').value;
        if(!wo || !ac) return;
        this.state.mappings[wo] = ac;
        Storage.saveMappings(this.state.mappings);
        UI.renderMappings(this.state.mappings);
        alert("Eşleşme kaydedildi. Mevcut verileri güncellemek için tekrar Excel yükleyin.");
    },

    switchView: function(view) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${view}`).classList.remove('hidden');
        document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
    }
};

App.init();
