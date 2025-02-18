// WebSocket connection handler with enhanced error handling and real-time updates
let ws;
let reconnectAttempts = 0;
let isConnected = false;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Initialize WebSocket connection
function initWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('WebSocket connection already exists');
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Initializing WebSocket connection to:', wsUrl);
    ws = new WebSocket(wsUrl);

    setupWebSocketHandlers();
}

// Set up WebSocket event handlers
function setupWebSocketHandlers() {
    ws.onopen = handleOpen;
    ws.onmessage = handleMessage;
    ws.onclose = handleClose;
    ws.onerror = handleError;
}

// Handle WebSocket connection open
function handleOpen() {
    console.log('WebSocket connection established');
    isConnected = true;
    reconnectAttempts = 0;
    updateConnectionStatus(true);
}

// Handle incoming WebSocket messages
function handleMessage(event) {
    try {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);

        switch (data.type) {
            case 'initialState':
                updateDashboard(data.data);
                break;
            case 'nodeStatus':
                updateNodeStatus(data.data);
                break;
            case 'performance':
                updatePerformanceData(data.data);
                break;
            case 'nodeCount':
                updateNodeCount(data.data);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

// Update dashboard with received data
function updateDashboard(data) {
    console.log('Updating dashboard with:', data);
    
    // Update node counts
    document.getElementById('totalNodes').textContent = data.total || data.totalNodes || 0;
    document.getElementById('activeNodes').textContent = data.active || data.activeNodes || 0;
    
    // Update nodes list if provided
    if (data.nodes) {
        const nodesList = document.querySelector('#nodesList');
        if (nodesList) {
            nodesList.innerHTML = ''; // Clear existing nodes
            data.nodes.forEach(node => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-node-id', node.nodeId);
                
                // Determinar el tipo de nodo (Windows o Mac)
                const isMac = node.nodeId.startsWith('mac-');
                const nodeType = isMac ? 'Mac (MLX)' : 'Windows (CUDA)';
                
                // Formatear los recursos según el tipo de nodo
                let resourcesHtml = node.resources;
                if (node.modelStatus) {
                    const modelStatus = node.modelStatus;
                    const modelInfo = isMac ? 
                        `MLX: ${modelStatus.status}` :
                        `CUDA: ${modelStatus.status}`;
                    
                    resourcesHtml += `<br><small class="text-gray-500">${modelInfo}</small>`;
                }
                
                tr.innerHTML = `
                    <td class="px-4 py-2">
                        ${node.nodeId}
                        <br>
                        <small class="text-gray-500">${nodeType}</small>
                    </td>
                    <td class="px-4 py-2 status ${node.status === 'connected' ? 'text-green-500' : 'text-red-500'}">
                        ${node.status}
                    </td>
                    <td class="px-4 py-2">${resourcesHtml}</td>
                `;
                nodesList.appendChild(tr);
            });
        }
    }
}

// Update node status in the dashboard
function updateNodeStatus(data) {
    console.log('Updating node status:', data);
    const nodesList = document.querySelector('#nodesList');
    if (!nodesList) return;

    let nodeElement = document.querySelector(`[data-node-id="${data.nodeId}"]`);
    
    // Determinar el tipo de nodo
    const isMac = data.nodeId.startsWith('mac-');
    const nodeType = isMac ? 'Mac (MLX)' : 'Windows (CUDA)';
    
    if (nodeElement) {
        // Actualizar nodo existente
        nodeElement.querySelector('.status').textContent = data.status;
        nodeElement.querySelector('.status').className = 
            `px-4 py-2 status ${data.status === 'connected' ? 'text-green-500' : 'text-red-500'}`;
        
        // Formatear recursos
        let resourcesHtml = data.resources;
        if (data.modelStatus) {
            const modelStatus = data.modelStatus;
            const modelInfo = isMac ? 
                `MLX: ${modelStatus.status}` :
                `CUDA: ${modelStatus.status}`;
            
            resourcesHtml += `<br><small class="text-gray-500">${modelInfo}</small>`;
        }
        
        nodeElement.lastElementChild.innerHTML = resourcesHtml;
        
        // Efecto de actualización
        nodeElement.classList.add('update-flash');
        setTimeout(() => nodeElement.classList.remove('update-flash'), 1000);
    } else {
        // Crear nuevo nodo
        const tr = document.createElement('tr');
        tr.setAttribute('data-node-id', data.nodeId);
        
        tr.innerHTML = `
            <td class="px-4 py-2">
                ${data.nodeId}
                <br>
                <small class="text-gray-500">${nodeType}</small>
            </td>
            <td class="px-4 py-2 status ${data.status === 'connected' ? 'text-green-500' : 'text-red-500'}">
                ${data.status}
            </td>
            <td class="px-4 py-2">${data.resources}</td>
        `;
        
        nodesList.appendChild(tr);
        tr.classList.add('update-flash');
    }
}

// Update performance data
function updatePerformanceData(data) {
    console.log('Updating performance data:', data);
    if (window.performanceChart) {
        window.performanceChart.data.datasets[0].data = [
            data.cpu || 0,
            data.memory || 0,
            data.gpu || 0
        ];
        window.performanceChart.update();
    }
}

// Update node count
function updateNodeCount(data) {
    console.log('Updating node count:', data);
    document.getElementById('totalNodes').textContent = data.total;
    document.getElementById('activeNodes').textContent = data.active;
}

// Handle WebSocket connection close
function handleClose() {
    console.log('WebSocket connection closed');
    isConnected = false;
    updateConnectionStatus(false);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
            console.log('Attempting to reconnect...');
            reconnectAttempts++;
            initWebSocket();
        }, RECONNECT_DELAY);
    } else {
        console.error('Max reconnection attempts reached');
        showError('Connection lost. Please refresh the page.');
    }
}

// Handle WebSocket errors
function handleError(error) {
    console.error('WebSocket error:', error);
    showError('Connection error occurred');
}

// Update connection status indicator
function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connectionStatus');
    if (statusIndicator) {
        statusIndicator.className = connected ? 'status-connected' : 'status-disconnected';
        statusIndicator.textContent = connected ? 'Connected' : 'Disconnected';
    }
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 5000);
    }
}

// Export functions for use in main dashboard
window.initWebSocket = initWebSocket;
window.updateConnectionStatus = updateConnectionStatus;