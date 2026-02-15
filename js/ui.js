const UI = {
    render: function() {
        const data = App.state.filteredData;
        this.updateStats(data);
        this.renderTable(data);
        this.renderCards(data);
        this.renderPagination(data.length);
        document.getElementById('last-import-time').textContent = App.state.lastImport || "-";
    },

    renderTable: function(data) {
        const tbody = document.getElementById('table-body');
        const thead = document.getElementById('table-head');
        tbody.innerHTML = ''; thead.innerHTML = '';

        if (!App.state.headers.length) return;

        // Header
        const trH = document.createElement('tr');
        App.state.headers.forEach(h => trH.innerHTML += `<th>${h}</th>`);
        thead.appendChild(trH);

        // Pagination Data
        const start = (App.state.currentPage - 1) * App.state.pageSize;
        const pageItems = data.slice(start, start + App.state.pageSize);

        pageItems.forEach((row, rIdx) => {
            const tr = document.createElement('tr');
            row.forEach((cell, cIdx) => {
                const td = document.createElement('td');
                if (cIdx === row.length - 2) { // Notlar
                    td.innerHTML = `<input type="text" class="table-note" value="${cell}" onchange="App.state.allData[${start + rIdx}][${cIdx}] = this.value; Storage.saveAll(App.state.allData, App.state.lastImport)">`;
                } else if (cIdx === row.length - 1) { // Bölüm
                    td.innerHTML = this.getDeptButtons(start + rIdx, cIdx, cell);
                } else {
                    td.textContent = cell;
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    },

    getDeptButtons: function(rowIdx, colIdx, activeDept) {
        const depts = ["Cabin", "Ortak Cabin", "AVI", "MEC", "STR", "OTHER"];
        return `<div class="dept-group">${depts.map(d => `
            <button class="dept-btn ${activeDept === d ? 'active' : ''}" 
            onclick="App.state.allData[${rowIdx}][${colIdx}]='${d}'; UI.render()">${d}</button>
        `).join('')}</div>`;
    },

    updateStats: function(data) {
        let stats = { OPEN: 0, CLOSED: 0, DEFER: 0 };
        data.forEach(row => {
            const s = String(row[7]).toUpperCase(); // Status sütunu varsayımı
            if (s.includes("OPEN")) stats.OPEN++;
            else if (s.includes("CLOSED")) stats.CLOSED++;
            else if (s.includes("DEFER")) stats.DEFER++;
        });
        document.getElementById('stat-open').textContent = stats.OPEN;
        document.getElementById('stat-closed').textContent = stats.CLOSED;
        document.getElementById('stat-defer').textContent = stats.DEFER;
    },

    renderPagination: function(total) {
        const pages = Math.ceil(total / App.state.pageSize);
        const container = document.getElementById('pagination');
        container.innerHTML = `
            <button class="btn" onclick="App.state.currentPage--; UI.render()" ${App.state.currentPage === 1 ? 'disabled' : ''}>Geri</button>
            <span>Sayfa ${App.state.currentPage} / ${pages}</span>
            <button class="btn" onclick="App.state.currentPage++; UI.render()" ${App.state.currentPage === pages ? 'disabled' : ''}>İleri</button>
        `;
    },

    toggleProgress: function(show) {
        document.getElementById('progress-container').classList.toggle('hidden', !show);
    },

    updateProgress: function(pct) {
        document.getElementById('progress-fill').style.width = pct + "%";
        document.getElementById('progress-text').textContent = "%" + pct;
    }
};
