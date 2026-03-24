// Mappings Page Logic
import Storage from './storage.js';

const MappingApp = {
    state: {
        woNumbers: [],
        tcNumbers: [],
        mapping: {}, // WO -> Aircraft Name
        tcMapping: {}, // TaskCard -> Department
        excludedWOs: [] // Persistent deleted WOs
    },

    init: async function () {
        console.log('Mapping App initialized');
        this.bindEvents();
        await this.loadData();
    },

    bindEvents: function () {
        document.getElementById('saveMapping').addEventListener('click', () => this.saveAllMappings());

        // Aircraft Mapping Events
        document.getElementById('add-entry-btn').addEventListener('click', () => this.addAircraftEntry());
        document.getElementById('new-aircraft').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addAircraftEntry();
        });

        // Aircraft Excel Import
        const aircraftExcelInput = document.getElementById('aircraftExcelInput');
        if (aircraftExcelInput) {
            aircraftExcelInput.addEventListener('change', (e) => this.handleExcelExport(e, 'aircraft'));
        }

        // Bulk Actions
        document.getElementById('bulk-delete-btn').addEventListener('click', () => this.bulkDeleteByAircraft());
        document.getElementById('delete-all-aircraft-btn').addEventListener('click', () => this.deleteAllAircraftMappings());
        const delAllTcBtn = document.getElementById('delete-all-tc-btn');
        if (delAllTcBtn) {
            delAllTcBtn.addEventListener('click', () => this.deleteAllTaskCardMappings());
        }

        // Task Card Mapping Events
        document.getElementById('add-tc-entry-btn').addEventListener('click', () => this.addTaskCardEntry());
        document.getElementById('new-tc').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTaskCardEntry();
        });

        // Task Card Excel Import
        const tcExcelInput = document.getElementById('tcExcelInput');
        if (tcExcelInput) {
            tcExcelInput.addEventListener('change', (e) => this.handleExcelExport(e, 'tc'));
        }
    },

    handleExcelExport: function (e, type) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (!json || json.length < 2) {
                    alert('Excel dosyası boş veya beklenen formatta değil.');
                    return;
                }

                if (type === 'aircraft') {
                    // Aircraft Mapping: Col 2 (index 1) = WO, Col 25 (index 24) = Aircraft Name
                    let count = 0;
                    for (let i = 1; i < json.length; i++) {
                        const row = json[i];
                        if (!row || row.length < 2) continue;

                        const wo = String(row[1] || '').trim();
                        const aircraft = String(row[24] || '').trim();

                        if (wo && aircraft) {
                            this.state.mapping[wo] = aircraft;
                            if (!this.state.woNumbers.includes(wo)) {
                                this.state.woNumbers.push(wo);
                            }
                            count++;
                        }
                    }
                    this.state.woNumbers.sort();
                    alert(`${count} adet uçak eşleştirmesi içe aktarıldı. Kaydetmeyi unutmayın!`);
                } else if (type === 'tc') {
                    // Task Card Mapping: Col 1 (index 0) = TC, Col 2 (index 1) = Dept
                    let count = 0;
                    const validDepts = ["Cabin", "Ortak Cabin", "TEKSTIL", "AVI", "MEC", "STR", "SEAT", "KAPLAMA"];

                    for (let i = 1; i < json.length; i++) {
                        const row = json[i];
                        if (!row || row.length < 1) continue;

                        const tc = String(row[0] || '').trim();
                        let deptRaw = String(row[1] || '').trim();

                        if (!tc) continue;

                        // Normalize department name to match our list
                        // Also handle "TEKSTİL" (with İ) common in TR locale
                        const matchedDept = validDepts.find(d =>
                            d.toUpperCase().replace('İ', 'I') === deptRaw.toUpperCase().replace('İ', 'I') ||
                            d.toUpperCase() === deptRaw.toUpperCase()
                        );

                        if (matchedDept) {
                            this.state.tcMapping[tc] = matchedDept;
                            if (!this.state.tcNumbers.includes(tc)) {
                                this.state.tcNumbers.push(tc);
                            }
                            count++;
                        }
                    }
                    this.state.tcNumbers.sort();
                    if (count === 0) {
                        alert('Eşleşen veri bulunamadı. Lütfen Excel formatını kontrol edin: \n1. Sütun: Task Card No\n2. Sütun: Bölüm (Cabin, AVI, vb.)');
                    } else {
                        alert(`${count} adet task card eşleştirmesi içe aktarıldı. Kaydetmeyi unutmayın!`);
                    }
                }

                this.render();
                // Clear input
                e.target.value = '';
            } catch (err) {
                console.error(err);
                alert('Dosya okunurken hata oluştu: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    addAircraftEntry: function () {
        const woInput = document.getElementById('new-wo');
        const aircraftInput = document.getElementById('new-aircraft');

        const wo = woInput.value.trim();
        const aircraft = aircraftInput.value.trim();

        if (!wo || !aircraft) {
            alert('Lütfen hem WO numarasını hem de uçak ismini girin.');
            return;
        }

        this.state.mapping[wo] = aircraft;
        // If it was excluded, it's not anymore
        this.state.excludedWOs = this.state.excludedWOs.filter(id => id !== wo);

        if (!this.state.woNumbers.includes(wo)) {
            this.state.woNumbers.push(wo);
            this.state.woNumbers.sort();
        }

        woInput.value = '';
        aircraftInput.value = '';
        this.render();
        woInput.focus();
    },

    bulkDeleteByAircraft: function () {
        const select = document.getElementById('bulk-aircraft-delete');
        const aircraftName = select.value;

        if (!aircraftName) {
            alert('Lütfen silmek istediğiniz uçağı seçin.');
            return;
        }

        if (!confirm(`${aircraftName} uçağına bağlı tüm WO kayıtlarını listeden silmek istediğinize emin misiniz? (Kalıcı olması için 'Kaydet' butonuna basmanız gerekir)`)) return;

        // Filter out WOs mapped to this aircraft
        const newMapping = {};
        const deletedWOs = [];
        Object.keys(this.state.mapping).forEach(wo => {
            if (this.state.mapping[wo] !== aircraftName) {
                newMapping[wo] = this.state.mapping[wo];
            } else {
                deletedWOs.push(wo);
            }
        });

        this.state.mapping = newMapping;
        this.state.woNumbers = this.state.woNumbers.filter(wo => !deletedWOs.includes(wo));

        this.render();
        alert(`${deletedWOs.length} adet kayıt listeden kaldırıldı. Kalıcı olması için 'Kaydet' butonuna basın.`);
    },

    deleteAllAircraftMappings: function () {
        if (!confirm('TÜM uçak eşleştirme verilerini listeden silmek istediğinize emin misiniz? (Kalıcı olması için "Kaydet" butonuna basmanız gerekir)')) return;

        // Add all current WOs to excluded list
        this.state.woNumbers.forEach(wo => {
            if (!this.state.excludedWOs.includes(wo)) {
                this.state.excludedWOs.push(wo);
            }
        });

        this.state.mapping = {};
        this.state.woNumbers = [];
        this.render();
        alert('Tüm uçak eşleştirmeleri listeden kaldırıldı. Kaydederek işlemi tamamlayabilirsiniz.');
    },

    deleteAllTaskCardMappings: function () {
        if (!confirm('TÜM Task Card eşleştirme verilerini listeden silmek istediğinize emin misiniz? (Kalıcı olması için "Kaydet" butonuna basmanız gerekir)')) return;

        this.state.tcMapping = {};
        this.state.tcNumbers = [];
        this.render();
        alert('Tüm Task Card eşleştirmeleri listeden kaldırıldı. Kaydederek işlemi tamamlayabilirsiniz.');
    },

    addTaskCardEntry: function () {
        const tcInput = document.getElementById('new-tc');
        const deptInput = document.getElementById('new-dept');

        const tc = tcInput.value.trim();
        const dept = deptInput.value.trim();

        if (!tc || !dept) {
            alert('Lütfen hem Task Card numarasını hem de Bölüm bilgisini girin.');
            return;
        }

        this.state.tcMapping[tc] = dept;
        if (!this.state.tcNumbers.includes(tc)) {
            this.state.tcNumbers.push(tc);
            this.state.tcNumbers.sort();
        }

        tcInput.value = '';
        deptInput.value = '';
        this.render();
        tcInput.focus();
    },

    loadData: async function () {
        this.showLoading(true);

        const mainData = await Storage.load();
        if (mainData && mainData.data) {
            const woSet = new Set();
            mainData.data.forEach(row => {
                const wo = row[2] ? String(row[2]).trim() : null;
                if (wo) woSet.add(wo);
            });
            this.state.woNumbers = Array.from(woSet);
        }

        // Load mappings
        const mappingRes = await Storage.loadMapping();
        this.state.mapping = mappingRes.mapping || {};
        this.state.excludedWOs = mappingRes.excludedWOs || [];

        // Load Task Card mappings
        this.state.tcMapping = await Storage.loadTaskCardMapping();

        // Filter woNumbers by excluded list
        this.state.woNumbers = this.state.woNumbers.filter(wo => !this.state.excludedWOs.includes(wo)).sort();

        // Task Card Mapping is manual-only now: only show what is mapped
        this.state.tcNumbers = Object.keys(this.state.tcMapping).sort();

        this.render();
        this.showLoading(false);
    },

    saveAllMappings: async function () {
        this.showLoading(true);
        // We save the state directly now, as render ensures state is always up to date
        const s1 = await Storage.saveMapping(this.state.mapping, this.state.excludedWOs);
        const s2 = await Storage.saveTaskCardMapping(this.state.tcMapping);

        this.showLoading(false);
        if (s1 && s2) {
            alert('Tüm eşleştirme verileri başarıyla kaydedildi!');
        }
    },

    showLoading: function (show) {
        const loading = document.getElementById('loading');
        const container = document.getElementById('mapping-container');
        if (show) {
            loading.classList.remove('hidden');
            container.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
            container.classList.remove('hidden');
        }
    },

    render: function () {
        const departments = ["Cabin", "Ortak Cabin", "TEKSTIL", "AVI", "MEC", "STR", "SEAT", "KAPLAMA"];

        // Populate Bulk Delete Dropdown
        const bulkSelect = document.getElementById('bulk-aircraft-delete');
        if (bulkSelect) {
            const currentVal = bulkSelect.value;
            const uniqueAircraftNames = [...new Set(Object.values(this.state.mapping))].sort();
            bulkSelect.innerHTML = '<option value="">Uçak Seçin</option>';
            uniqueAircraftNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                if (name === currentVal) opt.selected = true;
                bulkSelect.appendChild(opt);
            });
        }

        // Render Aircraft Mappings
        const aircraftTbody = document.getElementById('mapping-tbody');
        aircraftTbody.innerHTML = '';
        this.state.woNumbers.forEach(wo => {
            const tr = document.createElement('tr');
            tr.dataset.id = wo;
            tr.innerHTML = `
                <td class="tight-cell">${wo}</td>
                <td><input type="text" class="aircraft-input" value="${this.state.mapping[wo] || ''}" placeholder="Uçak ismi..."></td>
                <td style="width: 50px; text-align: center;">
                    <button class="btn btn-sm btn-delete" title="Sil">🗑️</button>
                </td>
            `;

            // Sync input changes to state immediately
            const input = tr.querySelector('.aircraft-input');
            input.addEventListener('input', (e) => {
                this.state.mapping[wo] = e.target.value.trim();
            });

            // Attach delete listener directly
            const deleteBtn = tr.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteEntry('aircraft', wo);
            });

            aircraftTbody.appendChild(tr);
        });

        // Render Task Card Mappings
        const tcTbody = document.getElementById('tc-mapping-tbody');
        tcTbody.innerHTML = '';
        this.state.tcNumbers.forEach(tc => {
            const tr = document.createElement('tr');
            tr.dataset.id = tc;
            const currentDept = this.state.tcMapping[tc] || '';
            let deptOptions = `<option value="">Bölüm Seçin</option>`;
            departments.forEach(dept => {
                deptOptions += `<option value="${dept}" ${currentDept === dept ? 'selected' : ''}>${dept}</option>`;
            });

            tr.innerHTML = `
                <td class="tight-cell">${tc}</td>
                <td>
                    <select class="dept-select">
                        ${deptOptions}
                    </select>
                </td>
                <td style="width: 50px; text-align: center;">
                    <button class="btn btn-sm btn-delete" title="Sil">🗑️</button>
                </td>
            `;

            // Sync select changes to state immediately
            const select = tr.querySelector('.dept-select');
            select.addEventListener('change', (e) => {
                this.state.tcMapping[tc] = e.target.value;
            });

            // Attach delete listener directly
            const deleteBtn = tr.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteEntry('tc', tc);
            });

            tcTbody.appendChild(tr);
        });
    },

    deleteEntry: function (type, id) {
        if (!confirm('Bu eşleştirmeyi listeden kaldırmak istediğinize emin misiniz? (Kalıcı olması için "Kaydet"e basın)')) return;

        if (type === 'aircraft') {
            const idStr = String(id);
            delete this.state.mapping[idStr];
            // Add to excluded list for persistence
            if (!this.state.excludedWOs.includes(idStr)) {
                this.state.excludedWOs.push(idStr);
            }
            this.state.woNumbers = this.state.woNumbers.filter(wo => String(wo) !== idStr);
        } else {
            delete this.state.tcMapping[id];
            this.state.tcNumbers = this.state.tcNumbers.filter(tc => tc !== id);
        }
        this.render();
    }
};

window.MappingApp = MappingApp; // Keep but mostly use event delegation
document.addEventListener('DOMContentLoaded', () => MappingApp.init());
export default MappingApp;
