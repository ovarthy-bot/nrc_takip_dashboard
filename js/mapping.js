import Storage from './storage.js';

const MappingApp = {
    init: async function () {
        this.bindEvents();
        await this.loadMappings();
    },

    bindEvents: function () {
        document.getElementById('addMappingBtn').addEventListener('click', () => this.addMapping());
    },

    loadMappings: async function () {
        const tbody = document.getElementById('mappingBody');
        tbody.innerHTML = '<tr><td colspan="3">Yükleniyor...</td></tr>';

        const mappings = await Storage.loadMappings();
        const sortedWOs = Object.keys(mappings).sort();

        tbody.innerHTML = '';
        if (sortedWOs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">Kayıtlı eşleştirme yok.</td></tr>';
            return;
        }

        sortedWOs.forEach(wo => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${wo}</td>
                <td>${mappings[wo]}</td>
                <td><button class="delete-btn" data-wo="${wo}">Sil</button></td>
            `;
            tbody.appendChild(tr);
        });

        // Add Delete Event Listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteMapping(e.target.dataset.wo));
        });
    },

    addMapping: async function () {
        const woInput = document.getElementById('woInput');
        const aircraftInput = document.getElementById('aircraftInput');

        const wo = woInput.value.trim();
        const aircraft = aircraftInput.value.trim();

        if (!wo || !aircraft) {
            alert('Lütfen her iki alanı da doldurun.');
            return;
        }

        const success = await Storage.saveMapping(wo, aircraft);
        if (success) {
            woInput.value = '';
            aircraftInput.value = '';
            await this.loadMappings(); // Reload table
        } else {
            alert('Hata oluştu.');
        }
    },

    deleteMapping: async function (wo) {
        if (confirm(`${wo} numaralı kaydı silmek istediğinize emin misiniz?`)) {
            await Storage.deleteMapping(wo);
            await this.loadMappings();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MappingApp.init();
});
