// Aircraft Mapping Page Logic
import Storage from './storage.js';

const MappingApp = {
    state: {
        woNumbers: [],
        mapping: {} // WO -> Aircraft Name
    },

    init: async function () {
        console.log('Mapping App initialized');
        this.bindEvents();
        await this.loadData();
    },

    bindEvents: function () {
        document.getElementById('saveMapping').addEventListener('click', () => this.saveMapping());
        document.getElementById('add-entry-btn').addEventListener('click', () => this.addManualEntry());

        // Handle keyboard enter on inputs
        document.getElementById('new-aircraft').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addManualEntry();
        });
    },

    addManualEntry: function () {
        const woInput = document.getElementById('new-wo');
        const aircraftInput = document.getElementById('new-aircraft');

        const wo = woInput.value.trim();
        const aircraft = aircraftInput.value.trim();

        if (!wo || !aircraft) {
            alert('Lütfen hem WO numarasını hem de uçak ismini girin.');
            return;
        }

        // Add to mapping state
        this.state.mapping[wo] = aircraft;

        // Ensure WO is in woNumbers list if not already
        if (!this.state.woNumbers.includes(wo)) {
            this.state.woNumbers.push(wo);
            this.state.woNumbers.sort();
        }

        // Clear inputs
        woInput.value = '';
        aircraftInput.value = '';

        // Re-render table
        this.render();

        // Focus first input for next entry
        woInput.focus();
    },

    loadData: async function () {
        this.showLoading(true);

        // Load main data to get WO numbers
        const mainData = await Storage.load();
        if (mainData && mainData.data) {
            // WO is at index 2 (after Aircraft Name and Department)
            const woSet = new Set();
            mainData.data.forEach(row => {
                const wo = row[2]; // WO column
                if (wo) woSet.add(wo);
            });
            this.state.woNumbers = Array.from(woSet).sort();
        }

        // Load existing mapping
        this.state.mapping = await Storage.loadMapping();

        this.render();
        this.showLoading(false);
    },

    saveMapping: async function () {
        // Collect mapping from table
        const rows = document.querySelectorAll('#mapping-tbody tr');
        const mapping = {};

        rows.forEach(row => {
            const wo = row.dataset.wo;
            const input = row.querySelector('input');
            const aircraftName = input.value.trim();
            if (aircraftName) {
                mapping[wo] = aircraftName;
            }
        });

        // Save to Firebase
        const success = await Storage.saveMapping(mapping);
        if (success) {
            alert('Eşleştirme verileri kaydedildi! Ana sayfaya dönebilirsiniz.');
            this.state.mapping = mapping;
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
        const tbody = document.getElementById('mapping-tbody');
        tbody.innerHTML = '';

        if (this.state.woNumbers.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.textContent = 'Henüz WO verisi yok. Lütfen önce ana sayfada Excel dosyası yükleyin.';
            td.style.textAlign = 'center';
            td.style.padding = '40px';
            td.style.color = 'var(--text-secondary)';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        this.state.woNumbers.forEach(wo => {
            const tr = document.createElement('tr');
            tr.dataset.wo = wo;

            // WO Number Cell
            const tdWo = document.createElement('td');
            tdWo.textContent = wo;
            tdWo.classList.add('tight-cell');

            // Aircraft Name Input Cell
            const tdAircraft = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'aircraft-input';
            input.placeholder = 'Uçak ismini girin...';
            input.value = this.state.mapping[wo] || '';
            tdAircraft.appendChild(input);

            tr.appendChild(tdWo);
            tr.appendChild(tdAircraft);
            tbody.appendChild(tr);
        });
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    MappingApp.init();
});

export default MappingApp;
