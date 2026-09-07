// Mappings Page Logic
import Storage from './storage.js';

// Normalization Helper for consistent WO comparisons and whitespace trimming
export function normalizeWO(value) {
    return String(value ?? '').trim();
}

const MappingApp = {
    state: {
        woNumbers: [],
        tcNumbers: [],
        mapping: {}, // WO -> Aircraft Name
        tcMapping: {}, // TaskCard -> Department
        excludedWOs: [], // Persistent deleted WOs
        isDirty: false,
        isSaving: false
    },

    validDepartments: ["Cabin", "Ortak Cabin", "TEKSTIL", "AVI", "MEC", "STR", "SEAT", "KAPLAMA"],

    init: async function () {
        console.log('Mapping App initialized');
        this.bindEvents();
        await this.loadData();
    },

    bindEvents: function () {
        // Save button
        const saveBtn = document.getElementById('saveMapping');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveAllMappings());
        }

        // Back button check for unsaved changes
        const backBtn = document.getElementById('back-home-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                if (this.state.isDirty) {
                    const confirmLeave = confirm('Kaydedilmemiş değişiklikleriniz var. Sayfadan çıkmak istediğinize emin misiniz?');
                    if (!confirmLeave) {
                        e.preventDefault();
                    }
                }
            });
        }

        // Window beforeunload
        window.addEventListener('beforeunload', (e) => {
            if (this.state.isDirty && !this.state.isSaving) {
                e.preventDefault();
                e.returnValue = 'Kaydedilmemiş değişiklikleriniz var. Sayfadan çıkmak istediğinize emin misiniz?';
                return e.returnValue;
            }
        });

        // Aircraft Mapping Events
        const addEntryBtn = document.getElementById('add-entry-btn');
        if (addEntryBtn) {
            addEntryBtn.addEventListener('click', () => this.addAircraftEntry());
        }

        const newWoInput = document.getElementById('new-wo');
        if (newWoInput) {
            newWoInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const newAircraft = document.getElementById('new-aircraft');
                    if (newAircraft && !newAircraft.value.trim()) {
                        newAircraft.focus();
                    } else {
                        this.addAircraftEntry();
                    }
                }
            });
        }

        const newAircraftInput = document.getElementById('new-aircraft');
        if (newAircraftInput) {
            newAircraftInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addAircraftEntry();
                }
            });
        }

        // Aircraft Excel Import
        const aircraftExcelInput = document.getElementById('aircraftExcelInput');
        if (aircraftExcelInput) {
            aircraftExcelInput.addEventListener('change', (e) => this.handleExcelExport(e, 'aircraft'));
        }

        // Bulk Actions
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => this.bulkDeleteByAircraft());
        }

        const delAllAircraftBtn = document.getElementById('delete-all-aircraft-btn');
        if (delAllAircraftBtn) {
            delAllAircraftBtn.addEventListener('click', () => this.deleteAllAircraftMappings());
        }

        const delAllTcBtn = document.getElementById('delete-all-tc-btn');
        if (delAllTcBtn) {
            delAllTcBtn.addEventListener('click', () => this.deleteAllTaskCardMappings());
        }

        // Task Card Mapping Events
        const addTcEntryBtn = document.getElementById('add-tc-entry-btn');
        if (addTcEntryBtn) {
            addTcEntryBtn.addEventListener('click', () => this.addTaskCardEntry());
        }

        const newTcInput = document.getElementById('new-tc');
        if (newTcInput) {
            newTcInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const newDept = document.getElementById('new-dept');
                    if (newDept && !newDept.value) {
                        newDept.focus();
                    } else {
                        this.addTaskCardEntry();
                    }
                }
            });
        }

        // Task Card Excel Import
        const tcExcelInput = document.getElementById('tcExcelInput');
        if (tcExcelInput) {
            tcExcelInput.addEventListener('change', (e) => this.handleExcelExport(e, 'tc'));
        }

        // Modal Close Buttons
        const closeModalBtn = document.getElementById('close-import-modal-btn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.closeImportModal());
        }

        const confirmModalBtn = document.getElementById('confirm-import-modal-btn');
        if (confirmModalBtn) {
            confirmModalBtn.addEventListener('click', () => this.closeImportModal());
        }
    },

    setDirty: function (isDirty) {
        this.state.isDirty = isDirty;
        const badge = document.getElementById('save-status-badge');
        if (!badge) return;

        if (this.state.isSaving) {
            badge.className = 'save-status-badge saving';
            badge.textContent = '⏳ Kaydediliyor...';
        } else if (isDirty) {
            badge.className = 'save-status-badge dirty';
            badge.textContent = '● Kaydedilmemiş değişiklikler';
        } else {
            badge.className = 'save-status-badge saved';
            badge.textContent = '✓ Kaydedildi';
        }
    },

    showToast: function (message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Auto remove after 3.5s
        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    },

    showImportModal: function (stats) {
        const modal = document.getElementById('import-modal');
        if (!modal) return;

        document.getElementById('import-stat-total').textContent = stats.totalRows;
        document.getElementById('import-stat-new').textContent = stats.newCount;
        document.getElementById('import-stat-updated').textContent = stats.updatedCount;
        document.getElementById('import-stat-skipped').textContent = stats.skippedCount;
        document.getElementById('import-stat-errors').textContent = stats.errorRows.length;

        const errorSection = document.getElementById('import-error-section');
        const errorTbody = document.getElementById('import-error-tbody');
        errorTbody.innerHTML = '';

        if (stats.errorRows.length > 0) {
            errorSection.classList.remove('hidden');
            stats.errorRows.forEach(item => {
                const tr = document.createElement('tr');
                
                const tdRow = document.createElement('td');
                tdRow.textContent = `Satır ${item.row}`;
                
                const tdInfo = document.createElement('td');
                tdInfo.textContent = item.info || '-';
                
                const tdReason = document.createElement('td');
                tdReason.textContent = item.reason || 'Hata';

                tr.appendChild(tdRow);
                tr.appendChild(tdInfo);
                tr.appendChild(tdReason);
                errorTbody.appendChild(tr);
            });
        } else {
            errorSection.classList.add('hidden');
        }

        modal.classList.remove('hidden');
    },

    closeImportModal: function () {
        const modal = document.getElementById('import-modal');
        if (modal) {
            modal.classList.add('hidden');
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
                const firstSheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (!json || json.length < 2) {
                    this.showToast('Excel dosyası boş veya beklenen satır verisi içermiyor.', 'error');
                    e.target.value = '';
                    return;
                }

                const headers = (json[0] || []).map(h => String(h || '').trim().toLowerCase());

                if (type === 'aircraft') {
                    // Header-based column discovery for Aircraft Mapping
                    const woHeaderKeywords = ['wo', 'work order', 'work order no', 'wo no', 'w.o.', 'w.o. no', 'w.o. no.'];
                    const aircraftHeaderKeywords = ['aircraft name', 'uçak ismi', 'uçak adı', 'aircraft', 'aircraft registration', 'uçak', 'ac reg', 'tail no'];

                    let woColIdx = -1;
                    let aircraftColIdx = -1;

                    for (let c = 0; c < headers.length; c++) {
                        const h = headers[c];
                        if (woColIdx === -1 && woHeaderKeywords.some(k => h === k || h.startsWith(k))) {
                            woColIdx = c;
                        }
                        if (aircraftColIdx === -1 && aircraftHeaderKeywords.some(k => h === k || h.startsWith(k))) {
                            aircraftColIdx = c;
                        }
                    }

                    // Fallbacks
                    if (woColIdx === -1) woColIdx = 1;
                    if (aircraftColIdx === -1) aircraftColIdx = 24;

                    console.log(`Aircraft Import detected columns -> WO: col ${woColIdx}, Aircraft: col ${aircraftColIdx}`);

                    const stats = {
                        totalRows: json.length - 1,
                        newCount: 0,
                        updatedCount: 0,
                        skippedCount: 0,
                        errorRows: []
                    };

                    for (let i = 1; i < json.length; i++) {
                        const row = json[i];
                        if (!row || row.length === 0) {
                            stats.skippedCount++;
                            continue;
                        }

                        const wo = normalizeWO(row[woColIdx]);
                        const aircraft = String(row[aircraftColIdx] || '').trim();

                        if (!wo) {
                            stats.skippedCount++;
                            continue;
                        }

                        if (!aircraft) {
                            stats.errorRows.push({
                                row: i + 1,
                                info: `WO: ${wo}`,
                                reason: 'Uçak İsmi boş'
                            });
                            continue;
                        }

                        // Determine if new or updated
                        if (this.state.mapping[wo] !== undefined) {
                            stats.updatedCount++;
                        } else {
                            stats.newCount++;
                        }

                        // Set mapping
                        this.state.mapping[wo] = aircraft;

                        // Critical Bug Fix: Un-exclude WO if it was previously excluded
                        this.state.excludedWOs = this.state.excludedWOs.filter(id => normalizeWO(id) !== wo);

                        // Ensure in woNumbers
                        if (!this.state.woNumbers.some(w => normalizeWO(w) === wo)) {
                            this.state.woNumbers.push(wo);
                        }
                    }

                    this.state.woNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    this.setDirty(true);
                    this.render();
                    this.showImportModal(stats);

                } else if (type === 'tc') {
                    // Header-based column discovery for Task Card Mapping
                    const tcHeaderKeywords = ['task card', 'task card no', 'tc', 'tc no', 'taskcard'];
                    const deptHeaderKeywords = ['bölüm', 'department', 'dept', 'kategori'];

                    let tcColIdx = -1;
                    let deptColIdx = -1;

                    for (let c = 0; c < headers.length; c++) {
                        const h = headers[c];
                        if (tcColIdx === -1 && tcHeaderKeywords.some(k => h === k || h.startsWith(k))) {
                            tcColIdx = c;
                        }
                        if (deptColIdx === -1 && deptHeaderKeywords.some(k => h === k || h.startsWith(k))) {
                            deptColIdx = c;
                        }
                    }

                    // Fallbacks
                    if (tcColIdx === -1) tcColIdx = 0;
                    if (deptColIdx === -1) deptColIdx = 1;

                    console.log(`Task Card Import detected columns -> TC: col ${tcColIdx}, Dept: col ${deptColIdx}`);

                    const stats = {
                        totalRows: json.length - 1,
                        newCount: 0,
                        updatedCount: 0,
                        skippedCount: 0,
                        errorRows: []
                    };

                    for (let i = 1; i < json.length; i++) {
                        const row = json[i];
                        if (!row || row.length === 0) {
                            stats.skippedCount++;
                            continue;
                        }

                        const tc = String(row[tcColIdx] || '').trim();
                        const deptRaw = String(row[deptColIdx] || '').trim();

                        if (!tc) {
                            stats.skippedCount++;
                            continue;
                        }

                        // Normalize department name to match valid list (handling Turkish 'İ' / 'I')
                        const matchedDept = this.validDepartments.find(d =>
                            d.toUpperCase().replace(/İ/g, 'I') === deptRaw.toUpperCase().replace(/İ/g, 'I') ||
                            d.toUpperCase() === deptRaw.toUpperCase()
                        );

                        if (!matchedDept) {
                            stats.errorRows.push({
                                row: i + 1,
                                info: `TC: ${tc}`,
                                reason: deptRaw ? `Geçersiz bölüm: "${deptRaw}"` : 'Bölüm bilgisi boş'
                            });
                            continue;
                        }

                        if (this.state.tcMapping[tc] !== undefined) {
                            stats.updatedCount++;
                        } else {
                            stats.newCount++;
                        }

                        this.state.tcMapping[tc] = matchedDept;
                        if (!this.state.tcNumbers.includes(tc)) {
                            this.state.tcNumbers.push(tc);
                        }
                    }

                    this.state.tcNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    this.setDirty(true);
                    this.render();
                    this.showImportModal(stats);
                }

                // Clear file input
                e.target.value = '';
            } catch (err) {
                console.error('Excel Import Error:', err);
                this.showToast('Dosya işlenirken hata oluştu: ' + err.message, 'error');
                e.target.value = '';
            }
        };

        reader.readAsArrayBuffer(file);
    },

    addAircraftEntry: function () {
        const woInput = document.getElementById('new-wo');
        const aircraftInput = document.getElementById('new-aircraft');

        const wo = normalizeWO(woInput.value);
        const aircraft = String(aircraftInput.value ?? '').trim();

        if (!wo || !aircraft) {
            this.showToast('Lütfen hem WO numarasını hem de uçak ismini eksiksiz girin.', 'error');
            return;
        }

        const isExisting = this.state.mapping[wo] !== undefined || this.state.woNumbers.some(w => normalizeWO(w) === wo);

        // Update or Add
        this.state.mapping[wo] = aircraft;

        // Critical Bug Fix: If it was in excludedWOs, remove it immediately
        this.state.excludedWOs = this.state.excludedWOs.filter(id => normalizeWO(id) !== wo);

        if (!this.state.woNumbers.some(w => normalizeWO(w) === wo)) {
            this.state.woNumbers.push(wo);
            this.state.woNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }

        woInput.value = '';
        aircraftInput.value = '';
        this.setDirty(true);
        this.render();

        if (isExisting) {
            this.showToast(`WO ${wo} zaten vardı, uçak ismi "${aircraft}" olarak güncellendi.`, 'info');
        } else {
            this.showToast(`WO ${wo} ➔ ${aircraft} eşleştirmesi eklendi.`, 'success');
        }

        woInput.focus();
    },

    addTaskCardEntry: function () {
        const tcInput = document.getElementById('new-tc');
        const deptInput = document.getElementById('new-dept');

        const tc = String(tcInput.value ?? '').trim();
        const dept = String(deptInput.value ?? '').trim();

        if (!tc || !dept) {
            this.showToast('Lütfen hem Task Card numarasını hem de Bölüm bilgisini seçin.', 'error');
            return;
        }

        const isExisting = this.state.tcMapping[tc] !== undefined;

        this.state.tcMapping[tc] = dept;
        if (!this.state.tcNumbers.includes(tc)) {
            this.state.tcNumbers.push(tc);
            this.state.tcNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }

        tcInput.value = '';
        deptInput.value = '';
        this.setDirty(true);
        this.render();

        if (isExisting) {
            this.showToast(`Task Card ${tc} bölümü "${dept}" olarak güncellendi.`, 'info');
        } else {
            this.showToast(`Task Card ${tc} ➔ ${dept} eşleştirmesi eklendi.`, 'success');
        }

        tcInput.focus();
    },

    bulkDeleteByAircraft: function () {
        const select = document.getElementById('bulk-aircraft-delete');
        const aircraftName = select.value;

        if (!aircraftName) {
            this.showToast('Lütfen silmek istediğiniz uçağı seçin.', 'error');
            return;
        }

        if (!confirm(`"${aircraftName}" uçağına bağlı tüm WO kayıtlarını listeden kaldırmak istediğinize emin misiniz? (Kalıcı olması için 'Kaydet' butonuna basmanız gerekir)`)) {
            return;
        }

        const newMapping = {};
        const deletedWOs = [];

        Object.keys(this.state.mapping).forEach(woKey => {
            const wo = normalizeWO(woKey);
            if (this.state.mapping[woKey] === aircraftName) {
                deletedWOs.push(wo);
                if (!this.state.excludedWOs.includes(wo)) {
                    this.state.excludedWOs.push(wo);
                }
            } else {
                newMapping[wo] = this.state.mapping[woKey];
            }
        });

        this.state.mapping = newMapping;
        this.state.woNumbers = this.state.woNumbers.filter(wo => !deletedWOs.includes(normalizeWO(wo)));

        this.setDirty(true);
        this.render();
        this.showToast(`${deletedWOs.length} adet WO kaydı listeden kaldırıldı. Kaydetmeyi unutmayın.`, 'info');
    },

    deleteAllAircraftMappings: function () {
        if (!confirm('TÜM uçak eşleştirme verilerini listeden silmek istediğinize emin misiniz? (Kalıcı olması için "Kaydet" butonuna basmanız gerekir)')) {
            return;
        }

        // Add all current WOs to excluded list
        this.state.woNumbers.forEach(wo => {
            const norm = normalizeWO(wo);
            if (norm && !this.state.excludedWOs.includes(norm)) {
                this.state.excludedWOs.push(norm);
            }
        });
        Object.keys(this.state.mapping).forEach(wo => {
            const norm = normalizeWO(wo);
            if (norm && !this.state.excludedWOs.includes(norm)) {
                this.state.excludedWOs.push(norm);
            }
        });

        this.state.mapping = {};
        this.state.woNumbers = [];
        this.setDirty(true);
        this.render();
        this.showToast('Tüm uçak eşleştirmeleri listeden kaldırıldı. Kaydederek işlemi tamamlayabilirsiniz.', 'info');
    },

    deleteAllTaskCardMappings: function () {
        if (!confirm('TÜM Task Card eşleştirme verilerini listeden silmek istediğinize emin misiniz? (Kalıcı olması için "Kaydet" butonuna basmanız gerekir)')) {
            return;
        }

        this.state.tcMapping = {};
        this.state.tcNumbers = [];
        this.setDirty(true);
        this.render();
        this.showToast('Tüm Task Card eşleştirmeleri listeden kaldırıldı. Kaydederek işlemi tamamlayabilirsiniz.', 'info');
    },

    deleteEntry: function (type, id) {
        if (type === 'aircraft') {
            const wo = normalizeWO(id);
            if (!confirm(`WO "${wo}" eşleştirmesini listeden kaldırmak istediğinize emin misiniz?`)) return;

            delete this.state.mapping[wo];
            
            // Add to excluded list for persistence
            if (!this.state.excludedWOs.includes(wo)) {
                this.state.excludedWOs.push(wo);
            }
            
            this.state.woNumbers = this.state.woNumbers.filter(w => normalizeWO(w) !== wo);
            this.setDirty(true);
            this.render();
            this.showToast(`WO ${wo} listeden kaldırıldı.`, 'info');
        } else {
            const tc = String(id).trim();
            if (!confirm(`Task Card "${tc}" eşleştirmesini listeden kaldırmak istediğinize emin misiniz?`)) return;

            delete this.state.tcMapping[tc];
            this.state.tcNumbers = this.state.tcNumbers.filter(t => t !== tc);
            this.setDirty(true);
            this.render();
            this.showToast(`Task Card ${tc} listeden kaldırıldı.`, 'info');
        }
    },

    loadData: async function () {
        this.showLoading(true);

        try {
            // 1. Load mappings from Firebase
            const mappingRes = await Storage.loadMapping();
            this.state.mapping = {};
            if (mappingRes && mappingRes.mapping) {
                Object.keys(mappingRes.mapping).forEach(k => {
                    const norm = normalizeWO(k);
                    if (norm) this.state.mapping[norm] = String(mappingRes.mapping[k] || '').trim();
                });
            }

            // Excluded WOs
            this.state.excludedWOs = (mappingRes && mappingRes.excludedWOs ? mappingRes.excludedWOs : []).map(normalizeWO);

            // 2. Load Task Card mappings
            this.state.tcMapping = await Storage.loadTaskCardMapping() || {};

            // 3. Load Main Data WOs to form a union
            const mainData = await Storage.load();
            const woSet = new Set();

            if (mainData && mainData.data && Array.isArray(mainData.data)) {
                mainData.data.forEach(row => {
                    const wo = row[2] ? normalizeWO(row[2]) : null;
                    if (wo) woSet.add(wo);
                });
            }

            // Union with mapping keys (Requirement 2)
            Object.keys(this.state.mapping).forEach(k => {
                const norm = normalizeWO(k);
                if (norm) woSet.add(norm);
            });

            // Filter out only actively excluded WOs
            this.state.woNumbers = Array.from(woSet)
                .filter(wo => !this.state.excludedWOs.includes(wo))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            // Task Card numbers
            this.state.tcNumbers = Object.keys(this.state.tcMapping).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            this.setDirty(false);
            this.render();
        } catch (err) {
            console.error('Error loading mapping data:', err);
            this.showToast('Veriler yüklenirken bir hata oluştu: ' + err.message, 'error');
        } finally {
            this.showLoading(false);
        }
    },

    saveAllMappings: async function () {
        if (this.state.isSaving) return;

        this.state.isSaving = true;
        this.setDirty(this.state.isDirty);

        const saveBtn = document.getElementById('saveMapping');
        if (saveBtn) {
            saveBtn.disabled = true;
            const textSpan = saveBtn.querySelector('.save-btn-text');
            if (textSpan) textSpan.textContent = 'Kaydediliyor...';
        }

        try {
            const s1 = await Storage.saveMapping(this.state.mapping, this.state.excludedWOs);
            const s2 = await Storage.saveTaskCardMapping(this.state.tcMapping);

            if (s1 && s2) {
                this.state.isDirty = false;
                this.state.isSaving = false;
                this.setDirty(false);
                this.showToast('✓ Tüm değişiklikler başarıyla kaydedildi.', 'success');

                setTimeout(() => {
                    window.location.href = './index.html';
                }, 750);
            } else {
                throw new Error(Storage.lastError ? Storage.lastError.message : 'Kayıt sırasında bir hata oluştu.');
            }
        } catch (err) {
            console.error('Save failed:', err);
            this.state.isSaving = false;
            this.setDirty(true);
            this.showToast('Veriler kaydedilemedi! İnternet bağlantınızı veya Firebase erişiminizi kontrol edin.', 'error');

            if (saveBtn) {
                saveBtn.disabled = false;
                const textSpan = saveBtn.querySelector('.save-btn-text');
                if (textSpan) textSpan.textContent = 'Kaydet';
            }
        }
    },

    showLoading: function (show) {
        const loading = document.getElementById('loading');
        const container = document.getElementById('mapping-container');
        if (!loading || !container) return;

        if (show) {
            loading.classList.remove('hidden');
            container.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
            container.classList.remove('hidden');
        }
    },

    render: function () {
        // Update Count Badges
        const aircraftBadge = document.getElementById('aircraft-count-badge');
        if (aircraftBadge) {
            aircraftBadge.textContent = `${this.state.woNumbers.length} kayıt`;
        }

        const tcBadge = document.getElementById('tc-count-badge');
        if (tcBadge) {
            tcBadge.textContent = `${this.state.tcNumbers.length} kayıt`;
        }

        // Populate Bulk Aircraft Select
        const bulkSelect = document.getElementById('bulk-aircraft-delete');
        if (bulkSelect) {
            const currentVal = bulkSelect.value;
            const uniqueAircraftNames = [...new Set(Object.values(this.state.mapping).filter(Boolean))].sort();
            bulkSelect.innerHTML = '<option value="">Uçak Seçin</option>';
            uniqueAircraftNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                if (name === currentVal) opt.selected = true;
                bulkSelect.appendChild(opt);
            });
        }

        // Render Aircraft Mappings (Desktop Table + Mobile Cards)
        this.renderAircraftMappings();

        // Render Task Card Mappings (Desktop Table + Mobile Cards)
        this.renderTaskCardMappings();
    },

    renderAircraftMappings: function () {
        const tbody = document.getElementById('mapping-tbody');
        const mobileList = document.getElementById('mapping-mobile-list');
        const emptyState = document.getElementById('aircraft-table-empty');

        if (!tbody || !mobileList) return;

        tbody.innerHTML = '';
        mobileList.innerHTML = '';

        if (this.state.woNumbers.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            const emptyMobile = document.createElement('div');
            emptyMobile.className = 'empty-state';
            emptyMobile.textContent = 'Eşleştirme kaydı bulunmuyor.';
            mobileList.appendChild(emptyMobile);
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        // DocumentFragment for high performance rendering (Test Scenario 7)
        const tableFrag = document.createDocumentFragment();
        const cardFrag = document.createDocumentFragment();

        this.state.woNumbers.forEach(woKey => {
            const wo = normalizeWO(woKey);
            const currentVal = this.state.mapping[wo] || '';

            // --- 1. Desktop Table Row ---
            const tr = document.createElement('tr');
            tr.dataset.wo = wo;

            const tdWo = document.createElement('td');
            tdWo.className = 'tight-cell font-mono';
            tdWo.textContent = wo;

            const tdInput = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'aircraft-input';
            input.value = currentVal;
            input.placeholder = 'Uçak ismi (Örn: TC-JSL)';
            input.autocomplete = 'off';

            input.addEventListener('input', (e) => {
                const newVal = e.target.value.trim();
                this.state.mapping[wo] = newVal;
                // Sync mobile card input if present
                const cardInput = mobileList.querySelector(`.mapping-card[data-wo="${wo}"] .mapping-card-input`);
                if (cardInput && cardInput.value !== e.target.value) {
                    cardInput.value = e.target.value;
                }
                this.setDirty(true);
            });

            tdInput.appendChild(input);

            const tdAction = document.createElement('td');
            tdAction.style.textAlign = 'center';
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-delete';
            delBtn.title = 'Sil';
            delBtn.setAttribute('aria-label', `WO ${wo} sil`);
            delBtn.textContent = '🗑️';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteEntry('aircraft', wo);
            });

            tdAction.appendChild(delBtn);

            tr.appendChild(tdWo);
            tr.appendChild(tdInput);
            tr.appendChild(tdAction);
            tableFrag.appendChild(tr);

            // --- 2. Mobile Card Item ---
            const card = document.createElement('div');
            card.className = 'mapping-card';
            card.dataset.wo = wo;

            const cardHeader = document.createElement('div');
            cardHeader.className = 'mapping-card-header';

            const cardTitle = document.createElement('div');
            cardTitle.className = 'mapping-card-title-group';
            const woBadge = document.createElement('span');
            woBadge.className = 'mapping-card-wo-badge';
            woBadge.textContent = `WO: ${wo}`;
            cardTitle.appendChild(woBadge);

            const cardDelBtn = document.createElement('button');
            cardDelBtn.className = 'mapping-card-delete-btn';
            cardDelBtn.setAttribute('aria-label', `WO ${wo} sil`);
            cardDelBtn.textContent = '🗑️';
            cardDelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteEntry('aircraft', wo);
            });

            cardHeader.appendChild(cardTitle);
            cardHeader.appendChild(cardDelBtn);

            const cardBody = document.createElement('div');
            cardBody.className = 'mapping-card-body';

            const label = document.createElement('label');
            label.className = 'mapping-card-label';
            label.textContent = 'Uçak İsmi';

            const cardInput = document.createElement('input');
            cardInput.type = 'text';
            cardInput.className = 'mapping-card-input';
            cardInput.value = currentVal;
            cardInput.placeholder = 'Uçak ismi girin (Örn: TC-JSL)';
            cardInput.autocomplete = 'off';

            cardInput.addEventListener('input', (e) => {
                const newVal = e.target.value.trim();
                this.state.mapping[wo] = newVal;
                // Sync table input if present
                const tblInput = tbody.querySelector(`tr[data-wo="${wo}"] .aircraft-input`);
                if (tblInput && tblInput.value !== e.target.value) {
                    tblInput.value = e.target.value;
                }
                this.setDirty(true);
            });

            cardBody.appendChild(label);
            cardBody.appendChild(cardInput);

            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            cardFrag.appendChild(card);
        });

        tbody.appendChild(tableFrag);
        mobileList.appendChild(cardFrag);
    },

    renderTaskCardMappings: function () {
        const tbody = document.getElementById('tc-mapping-tbody');
        const mobileList = document.getElementById('tc-mobile-list');
        const emptyState = document.getElementById('tc-table-empty');

        if (!tbody || !mobileList) return;

        tbody.innerHTML = '';
        mobileList.innerHTML = '';

        if (this.state.tcNumbers.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            const emptyMobile = document.createElement('div');
            emptyMobile.className = 'empty-state';
            emptyMobile.textContent = 'Task Card eşleştirme kaydı bulunmuyor.';
            mobileList.appendChild(emptyMobile);
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        const tableFrag = document.createDocumentFragment();
        const cardFrag = document.createDocumentFragment();

        this.state.tcNumbers.forEach(tc => {
            const currentDept = this.state.tcMapping[tc] || '';

            // --- 1. Desktop Table Row ---
            const tr = document.createElement('tr');
            tr.dataset.tc = tc;

            const tdTc = document.createElement('td');
            tdTc.className = 'tight-cell font-mono';
            tdTc.textContent = tc;

            const tdSelect = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'dept-select';

            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Bölüm Seçin';
            select.appendChild(defaultOpt);

            this.validDepartments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept;
                opt.textContent = dept;
                if (currentDept === dept) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                this.state.tcMapping[tc] = e.target.value;
                const cardSelect = mobileList.querySelector(`.mapping-card[data-tc="${tc}"] .mapping-card-select`);
                if (cardSelect && cardSelect.value !== e.target.value) {
                    cardSelect.value = e.target.value;
                }
                this.setDirty(true);
            });

            tdSelect.appendChild(select);

            const tdAction = document.createElement('td');
            tdAction.style.textAlign = 'center';
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-delete';
            delBtn.title = 'Sil';
            delBtn.setAttribute('aria-label', `Task Card ${tc} sil`);
            delBtn.textContent = '🗑️';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteEntry('tc', tc);
            });

            tdAction.appendChild(delBtn);

            tr.appendChild(tdTc);
            tr.appendChild(tdSelect);
            tr.appendChild(tdAction);
            tableFrag.appendChild(tr);

            // --- 2. Mobile Card Item ---
            const card = document.createElement('div');
            card.className = 'mapping-card';
            card.dataset.tc = tc;

            const cardHeader = document.createElement('div');
            cardHeader.className = 'mapping-card-header';

            const cardTitle = document.createElement('div');
            cardTitle.className = 'mapping-card-title-group';
            const tcBadge = document.createElement('span');
            tcBadge.className = 'mapping-card-wo-badge';
            tcBadge.textContent = `TC: ${tc}`;
            cardTitle.appendChild(tcBadge);

            const cardDelBtn = document.createElement('button');
            cardDelBtn.className = 'mapping-card-delete-btn';
            cardDelBtn.setAttribute('aria-label', `Task Card ${tc} sil`);
            cardDelBtn.textContent = '🗑️';
            cardDelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteEntry('tc', tc);
            });

            cardHeader.appendChild(cardTitle);
            cardHeader.appendChild(cardDelBtn);

            const cardBody = document.createElement('div');
            cardBody.className = 'mapping-card-body';

            const label = document.createElement('label');
            label.className = 'mapping-card-label';
            label.textContent = 'Bölüm';

            const cardSelect = document.createElement('select');
            cardSelect.className = 'mapping-card-select';

            const cardDefaultOpt = document.createElement('option');
            cardDefaultOpt.value = '';
            cardDefaultOpt.textContent = 'Bölüm Seçin';
            cardSelect.appendChild(cardDefaultOpt);

            this.validDepartments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept;
                opt.textContent = dept;
                if (currentDept === dept) opt.selected = true;
                cardSelect.appendChild(opt);
            });

            cardSelect.addEventListener('change', (e) => {
                this.state.tcMapping[tc] = e.target.value;
                const tblSelect = tbody.querySelector(`tr[data-tc="${tc}"] .dept-select`);
                if (tblSelect && tblSelect.value !== e.target.value) {
                    tblSelect.value = e.target.value;
                }
                this.setDirty(true);
            });

            cardBody.appendChild(label);
            cardBody.appendChild(cardSelect);

            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            cardFrag.appendChild(card);
        });

        tbody.appendChild(tableFrag);
        mobileList.appendChild(cardFrag);
    }
};

window.MappingApp = MappingApp;
document.addEventListener('DOMContentLoaded', () => MappingApp.init());
export default MappingApp;
