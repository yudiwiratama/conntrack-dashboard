// Dashboard JavaScript untuk Conntrack
const API_BASE = '';

let charts = {};
let allConnections = [];
let filteredConnections = [];
let displayedConnections = [];
let autoRefreshInterval = null;
let currentSort = { column: null, direction: 'asc' };
let currentLimit = 100;

// Inisialisasi dashboard
document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    loadData();
    setupEventListeners();
    startAutoRefresh();
});

function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', loadData);
    document.getElementById('autoRefresh').addEventListener('change', (e) => {
        if (e.target.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
    
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('filterProtocol').addEventListener('change', applyFilters);
    document.getElementById('filterState').addEventListener('change', applyFilters);
    // Setup limit selector
    const limitSelect = document.getElementById('limitSelect');
    if (limitSelect) {
        // Initialize limit from select value
        const initialValue = limitSelect.value;
        currentLimit = initialValue === 'all' ? Infinity : parseInt(initialValue);
        
        // Add event listener
        limitSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            currentLimit = value === 'all' ? Infinity : parseInt(value);
            applyFilters();
        });
    }
    
    // Setup sorting untuk setiap kolom
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            sortTable(column);
        });
    });
}

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(loadData, 5000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

async function loadData() {
    try {
        const response = await fetch(`${API_BASE}/api/summary`);
        const result = await response.json();
        
        if (result.success) {
            updateDashboard(result.data);
        } else {
            // Handle error dari API
            const errorMsg = result.data?.error || 'Tidak ada data yang ditemukan';
            showError(errorMsg);
            updateDashboard(result.data || { total_connections: 0 });
        }
        
        // Load detailed connections
        const connResponse = await fetch(`${API_BASE}/api/connections`);
        const connResult = await connResponse.json();
        
        if (connResult.success) {
            allConnections = connResult.data || [];
            // Reset filters dan apply limit
            filteredConnections = allConnections;
            displayedConnections = [];
            // Pastikan limit di-initialize dari select
            const limitSelect = document.getElementById('limitSelect');
            if (limitSelect) {
                const limitValue = limitSelect.value;
                currentLimit = limitValue === 'all' ? Infinity : parseInt(limitValue);
            }
            applyFilters();
            updateFilters();
        } else {
            // Handle error dari connections API
            const errorMsg = connResult.error || connResult.message || 'Tidak ada koneksi yang ditemukan';
            if (connResult.error) {
                showError(errorMsg);
            }
            allConnections = [];
            filteredConnections = [];
            displayedConnections = [];
            updateConnectionsTable();
        }
        
        updateLastUpdate();
    } catch (error) {
        console.error('Error loading data:', error);
        showError(`Gagal memuat data: ${error.message}. Pastikan backend berjalan di http://localhost:8000`);
    }
}

function updateDashboard(summary) {
    if (!summary) {
        summary = { total_connections: 0, by_protocol: {}, by_state: {} };
    }
    
    // Update stats
    document.getElementById('totalConnections').textContent = (summary.total_connections || 0).toLocaleString();
    document.getElementById('activeProtocols').textContent = Object.keys(summary.by_protocol || {}).length;
    document.getElementById('uniqueStates').textContent = Object.keys(summary.by_state || {}).length;
    document.getElementById('updateTime').textContent = summary.timestamp ? 
        new Date(summary.timestamp).toLocaleTimeString('id-ID') : '-';
    
    // Update charts (hanya jika ada data)
    if (summary.by_protocol && Object.keys(summary.by_protocol).length > 0) {
        updateProtocolChart(summary.by_protocol);
    }
    if (summary.by_state && Object.keys(summary.by_state).length > 0) {
        updateStateChart(summary.by_state);
    }
    if (summary.top_source_ips && summary.top_source_ips.length > 0) {
        updateSourceIpChart(summary.top_source_ips);
    }
    if (summary.top_destination_ips && summary.top_destination_ips.length > 0) {
        updateDestIpChart(summary.top_destination_ips);
    }
    if (summary.top_destination_ports && summary.top_destination_ports.length > 0) {
        updateDestPortChart(summary.top_destination_ports);
    }
    if (summary.protocol_state_matrix && Object.keys(summary.protocol_state_matrix).length > 0) {
        updateProtocolStateChart(summary.protocol_state_matrix);
    }
}

function initializeCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom',
            }
        }
    };
    
    // Protocol Chart
    charts.protocol = new Chart(document.getElementById('protocolChart'), {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: chartOptions
    });
    
    // State Chart
    charts.state = new Chart(document.getElementById('stateChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Jumlah', data: [], backgroundColor: '#667eea' }] },
        options: { ...chartOptions, indexAxis: 'y' }
    });
    
    // Source IP Chart
    charts.sourceIp = new Chart(document.getElementById('sourceIpChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Koneksi', data: [], backgroundColor: '#764ba2' }] },
        options: chartOptions
    });
    
    // Destination IP Chart
    charts.destIp = new Chart(document.getElementById('destIpChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Koneksi', data: [], backgroundColor: '#f093fb' }] },
        options: chartOptions
    });
    
    // Destination Port Chart
    charts.destPort = new Chart(document.getElementById('destPortChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Koneksi', data: [], backgroundColor: '#4facfe' }] },
        options: chartOptions
    });
    
    // Protocol-State Matrix Chart
    charts.protocolState = new Chart(document.getElementById('protocolStateChart'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: { ...chartOptions, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
}

function updateProtocolChart(data) {
    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = generateColors(labels.length);
    
    charts.protocol.data.labels = labels;
    charts.protocol.data.datasets[0].data = values;
    charts.protocol.data.datasets[0].backgroundColor = colors;
    charts.protocol.update();
}

function updateStateChart(data) {
    const labels = Object.keys(data);
    const values = Object.values(data);
    
    charts.state.data.labels = labels;
    charts.state.data.datasets[0].data = values;
    charts.state.update();
}

function updateSourceIpChart(data) {
    const labels = data.map(item => item.ip);
    const values = data.map(item => item.count);
    
    charts.sourceIp.data.labels = labels;
    charts.sourceIp.data.datasets[0].data = values;
    charts.sourceIp.update();
}

function updateDestIpChart(data) {
    const labels = data.map(item => item.ip);
    const values = data.map(item => item.count);
    
    charts.destIp.data.labels = labels;
    charts.destIp.data.datasets[0].data = values;
    charts.destIp.update();
}

function updateDestPortChart(data) {
    const labels = data.map(item => `Port ${item.port}`);
    const values = data.map(item => item.count);
    
    charts.destPort.data.labels = labels;
    charts.destPort.data.datasets[0].data = values;
    charts.destPort.update();
}

function updateProtocolStateChart(data) {
    // Prepare data for stacked bar chart
    const protocols = Object.keys(data);
    const allStates = new Set();
    
    protocols.forEach(protocol => {
        Object.keys(data[protocol]).forEach(state => allStates.add(state));
    });
    
    const states = Array.from(allStates);
    const colors = generateColors(states.length);
    
    const datasets = states.map((state, index) => ({
        label: state,
        data: protocols.map(protocol => data[protocol][state] || 0),
        backgroundColor: colors[index]
    }));
    
    charts.protocolState.data.labels = protocols;
    charts.protocolState.data.datasets = datasets;
    charts.protocolState.update();
}

function generateColors(count) {
    const colors = [
        '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe',
        '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8edea',
        '#fed6e3', '#ffecd2', '#fcb69f', '#ff9a9e', '#fecfef'
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    return result;
}

function sortTable(column) {
    // Toggle direction jika kolom yang sama diklik
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    // Sort filtered connections
    filteredConnections.sort((a, b) => {
        let aVal = a[column] || '';
        let bVal = b[column] || '';
        
        // Handle numeric values untuk port, mark, use
        if (column === 'sport' || column === 'dport' || column === 'mark' || column === 'use') {
            aVal = parseInt(aVal) || 0;
            bVal = parseInt(bVal) || 0;
            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle IP addresses (sort numerically)
        if (column === 'src' || column === 'dst') {
            // Convert IP to number for proper sorting
            const ipToNum = (ip) => {
                if (!ip || ip === '-') return 0;
                const parts = ip.split('.');
                if (parts.length === 4) {
                    return parseInt(parts[0]) * 256**3 + 
                           parseInt(parts[1]) * 256**2 + 
                           parseInt(parts[2]) * 256 + 
                           parseInt(parts[3]);
                }
                return 0;
            };
            aVal = ipToNum(aVal);
            bVal = ipToNum(bVal);
            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // String comparison untuk protocol, state, dan flags
        // Handle empty values untuk flags
        if (column === 'flags') {
            aVal = aVal === '-' || !aVal ? '' : String(aVal).toLowerCase();
            bVal = bVal === '-' || !bVal ? '' : String(bVal).toLowerCase();
        } else {
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Update sort indicators
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.getAttribute('data-sort') === column) {
            th.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
    
    // Update table
    updateConnectionsTable();
}

function updateConnectionsTable() {
    const tbody = document.getElementById('connectionsTableBody');
    
    if (filteredConnections.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Tidak ada data yang sesuai filter</td></tr>';
        return;
    }
    
    // Apply limit
    const limit = currentLimit === Infinity ? filteredConnections.length : currentLimit;
    displayedConnections = filteredConnections.slice(0, limit);
    
    tbody.innerHTML = displayedConnections.map(conn => {
        const protocol = (conn.protocol || 'unknown').toUpperCase();
        const protocolLower = protocol.toLowerCase();
        const state = conn.state || 'UNKNOWN';
        const src = conn.src || '-';
        const sport = conn.sport || '-';
        const dst = conn.dst || '-';
        const dport = conn.dport || '-';
        const flags = conn.flags || '-';
        const mark = conn.mark || '-';
        const use = conn.use || '-';
        
        // Pastikan class protocol ada (untuk protocol yang belum didefinisikan, akan menggunakan default)
        const protocolClass = ['tcp', 'udp', 'icmp', 'icmpv6', 'gre', 'esp', 'ah'].includes(protocolLower) 
            ? `protocol-${protocolLower}` 
            : 'protocol-other';
        
        // Format flags dengan badge jika ada
        let flagsDisplay = '-';
        if (flags !== '-') {
            const flagParts = flags.split(',').map(f => f.trim());
            flagsDisplay = flagParts.map(flag => {
                const flagLower = flag.toLowerCase();
                return `<span class="flag-badge flag-${flagLower}">${flag}</span>`;
            }).join(' ');
        }
        
        return `
            <tr>
                <td><span class="protocol-badge ${protocolClass}">${protocol}</span></td>
                <td><span class="state-badge state-${state.toLowerCase().replace(/_/g, '-')}">${state}</span></td>
                <td>${src}</td>
                <td>${sport}</td>
                <td>${dst}</td>
                <td>${dport}</td>
                <td>${flagsDisplay}</td>
                <td>${mark}</td>
                <td>${use}</td>
            </tr>
        `;
    }).join('');
    
    // Add info row jika ada limit dan masih ada data yang tidak ditampilkan
    if (currentLimit !== Infinity && filteredConnections.length > currentLimit) {
        const remaining = filteredConnections.length - currentLimit;
        tbody.innerHTML += `
            <tr>
                <td colspan="9" class="loading" style="text-align: center; padding: 15px !important; color: rgba(232, 234, 246, 0.7);">
                    Menampilkan ${displayedConnections.length} dari ${filteredConnections.length} koneksi. 
                    ${remaining} koneksi lainnya tidak ditampilkan. 
                    <span style="color: #4285f4; cursor: pointer; text-decoration: underline;" onclick="document.getElementById('limitSelect').value='all'; document.getElementById('limitSelect').dispatchEvent(new Event('change'));">
                        Tampilkan semua
                    </span>
                </td>
            </tr>
        `;
    } else if (filteredConnections.length > 0 && displayedConnections.length === filteredConnections.length) {
        tbody.innerHTML += `
            <tr>
                <td colspan="9" class="loading" style="text-align: center; padding: 10px !important; color: rgba(232, 234, 246, 0.6); font-size: 0.9em;">
                    Menampilkan semua ${filteredConnections.length} koneksi
                </td>
            </tr>
        `;
    }
}

function updateFilters() {
    // Update protocol filter
    const protocols = [...new Set(allConnections.map(c => c.protocol).filter(Boolean))];
    const protocolSelect = document.getElementById('filterProtocol');
    const currentProtocol = protocolSelect.value;
    
    protocolSelect.innerHTML = '<option value="">Semua Protocol</option>' +
        protocols.map(p => `<option value="${p}">${p.toUpperCase()}</option>`).join('');
    
    if (currentProtocol && protocols.includes(currentProtocol)) {
        protocolSelect.value = currentProtocol;
    }
    
    // Update state filter
    const states = [...new Set(allConnections.map(c => c.state).filter(Boolean))];
    const stateSelect = document.getElementById('filterState');
    const currentState = stateSelect.value;
    
    stateSelect.innerHTML = '<option value="">Semua State</option>' +
        states.map(s => `<option value="${s}">${s}</option>`).join('');
    
    if (currentState && states.includes(currentState)) {
        stateSelect.value = currentState;
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const protocolFilter = document.getElementById('filterProtocol').value;
    const stateFilter = document.getElementById('filterState').value;
    
    filteredConnections = allConnections.filter(conn => {
        const matchSearch = !searchTerm || 
            (conn.src && conn.src.toLowerCase().includes(searchTerm)) ||
            (conn.dst && conn.dst.toLowerCase().includes(searchTerm)) ||
            (conn.sport && conn.sport.toString().includes(searchTerm)) ||
            (conn.dport && conn.dport.toString().includes(searchTerm)) ||
            (conn.protocol && conn.protocol.toLowerCase().includes(searchTerm)) ||
            (conn.state && conn.state.toLowerCase().includes(searchTerm));
        
        const matchProtocol = !protocolFilter || conn.protocol === protocolFilter;
        const matchState = !stateFilter || conn.state === stateFilter;
        
        return matchSearch && matchProtocol && matchState;
    });
    
    // Re-apply sorting jika ada
    if (currentSort.column) {
        sortTable(currentSort.column);
    } else {
        updateConnectionsTable();
    }
}

function updateLastUpdate() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = 
        `Terakhir update: ${now.toLocaleTimeString('id-ID')}`;
}

function showError(message) {
    const tbody = document.getElementById('connectionsTableBody');
    tbody.innerHTML = `<tr><td colspan="9" class="loading" style="color: #d32f2f; font-weight: bold; padding: 30px !important;">
        <div style="text-align: center;">
            <div style="font-size: 2em; margin-bottom: 10px;">⚠️</div>
            <div>${message}</div>
            <div style="margin-top: 15px; font-size: 0.9em; color: #666;">
                💡 Tips: Jalankan server dengan <code>sudo python app.py</code>
            </div>
        </div>
    </td></tr>`;
    
    // Update stats untuk menunjukkan error
    document.getElementById('totalConnections').textContent = '0';
    document.getElementById('activeProtocols').textContent = '0';
    document.getElementById('uniqueStates').textContent = '0';
}

