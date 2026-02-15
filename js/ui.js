const UI = {
    render: function(data) {
        this.renderTable(data);
        this.renderCards(data);
        document.getElementById('last-import-time').textContent = App.state.lastImport || "-";
    },

    renderTable: function(data) {
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';
        
        // Pagination: Sadece mevcut sayfayı bas
        const start = (App.state.currentPage - 1) * App.state.pageSize;
        const pageData = data.slice(start, start + App.state.pageSize);

        pageData.forEach((row, idx) => {
            const tr = document.createElement('tr');
            row.forEach((cell, i) => {
                const td = document.createElement('td');
                if (i === row.length - 2) { // Not Sütunu (Sondan bir önceki varsayalım)
                    const textarea = document.createElement('textarea');
                    textarea.className = 'note-textarea';
                    textarea.value = cell || "";
                    textarea.onchange = (e) => { row[i] = e.target.value; Storage.saveData({data: App.state.allData, timestamp: App.state.lastImport}); };
                    td.appendChild(textarea);
                } else if (i === row.length - 1) { // Bölüm Sütunu
                    td.innerHTML = this.createDeptButtons(row, i);
                } else {
                    td.textContent = cell;
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        this.renderPagination(data.length);
    },

    createDeptButtons: function(row, colIdx) {
        const depts = ["Cabin", "Ortak Cabin", "AVI", "MEC", "STR", "OTHER"];
        return `<div class="dept-btn-group">
            ${depts.map(d => `<button class="dept-btn ${row[colIdx] === d ? 'active' : ''}" 
                onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active')); this.classList.add('active'); App.state.allData[App.state.allData.indexOf(row)][${colIdx}]='${d}'; Storage.saveData({data: App.state.allData});">
                ${d}</button>`).join('')}
        </div>`;
    },

    updateStats: function(data) {
        // Status sütununun indexini bul (Örn: Excel'de 6. sütun + 1 (Uçak ismi eklediğimiz için))
        const stats = { OPEN: 0, CLOSED: 0, DEFER: 0 };
        data.forEach(row => {
            const status = String(row[7]).toUpperCase(); // Statü sütunu örneği
            if(status.includes("OPEN")) stats.OPEN++;
            else if(status.includes("CLOSED")) stats.CLOSED++;
            else if(status.includes("DEFER")) stats.DEFER++;
        });
        document.getElementById('stat-open').textContent = stats.OPEN;
        document.getElementById('stat-closed').textContent = stats.CLOSED;
        document.getElementById('stat-defer').textContent = stats.DEFER;
    },

    renderPagination: function(total) {
        const container = document.getElementById('pagination-controls');
        const pages = Math.ceil(total / App.state.pageSize);
        container.innerHTML = `<span>Sayfa ${App.state.currentPage} / ${pages}</span> 
            <button onclick="App.state.currentPage--; App.applyFilters()" ${App.state.currentPage===1?'disabled':''}>Geri</button>
            <button onclick="App.state.currentPage++; App.applyFilters()" ${App.state.currentPage===pages?'disabled':''}>İleri</button>`;
    }
};
