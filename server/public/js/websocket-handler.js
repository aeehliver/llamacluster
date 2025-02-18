// WebSocket connection handler
let ws;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Visual feedback function
function flashElement(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.style.transition = 'background-color 0.5s';
    element.style.backgroundColor = '#4CAF50';
    
    setTimeout(() => {
        element.style.backgroundColor = '';
    }, 1000);
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'connection-status';
    statusIndicator.style.position = 'fixed';
    statusIndicator.style.top = '10px';
    statusIndicator.style.right = '10px';
    statusIndicator.style.padding = '8px 16px';
    statusIndicator.style.borderRadius = '4px';
    statusIndicator.style.color = 'white';
    statusIndicator.style.fontWeight = 'bold';
    
    if (connected) {
        statusIndicator.style.backgroundColor = '#4CAF50';
        statusIndicator.textContent = 'Connected';
    } else {
        statusIndicator.style.backgroundColor = '#f44336';
        statusIndicator.textContent = 'Disconnected';
    }
    
    const existingIndicator = document.getElementById('connection-status');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    document.body.appendChild(statusIndicator);
}

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connection established');
        reconnectAttempts = 0;
        updateConnectionStatus(true);
        // Fetch initial model data
        fetch('/api/model/current')
            .then(response => response.json())
            .then(data => updateModelStatus(data))
            .catch(error => console.error('Error fetching model data:', error));
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
        updateConnectionStatus(false);
        handleReconnection();
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function handleWebSocketMessage(data) {
    console.log('Received WebSocket message:', data);
    switch (data.type) {
        case 'node-count-update':
            console.log('Node count updated:', data.count);
            // Update the historical data chart with the new node count
            updateHistoricalData(data.count);
            // Update the total nodes display
            document.getElementById('totalNodes').textContent = data.count;
            document.getElementById('activeNodes').textContent = data.count;
            // Add visual feedback
            flashElement('totalNodes');
            break;
        case 'modelStatus':
            console.log('Model status updated:', data.model);
            updateModelStatus(data.model);
            break;
        case 'nodeStatus':
            console.log('Node status updated:', data.nodes);
            updateNodeList(data.nodes);
            break;
        case 'model-status-update':
            console.log('Model status update received:', data.modelStatus);
            updateModelStatus(data.modelStatus);
            break;
        case 'connection':
            console.log('New client connected:', data.clientId);
            // You can add specific handling for new connections here
            break;
        default:
            console.log('Unhandled message type:', data.type);
    }
}

function handleReconnection() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(initWebSocket, RECONNECT_DELAY);
    } else {
        console.error('Max reconnection attempts reached');
    }
}

function updateModelStatus(model) {
    if (!model) return;
    document.getElementById('modelName').textContent = model.name || '-';
    document.getElementById('modelStatus').textContent = model.status || '-';
    document.getElementById('modelSize').textContent = model.size || '-';

    if (model.parameters) {
        const temp = document.getElementById('temperature');
        const tempValue = document.getElementById('temperatureValue');
        const maxLength = document.getElementById('maxLength');
        const topP = document.getElementById('topP');
        const topPValue = document.getElementById('topPValue');

        if (temp && tempValue) {
            temp.value = model.parameters.temperature;
            tempValue.textContent = model.parameters.temperature;
        }
        if (maxLength) maxLength.value = model.parameters.max_length;
        if (topP && topPValue) {
            topP.value = model.parameters.top_p;
            topPValue.textContent = model.parameters.top_p;
        }
    }
}

function updateNodeList(nodes) {
    const nodeList = document.getElementById('nodeList');
    if (!nodeList || !Array.isArray(nodes)) return;

    nodeList.innerHTML = nodes.map(node => `
        <tr>
            <td class="px-4 py-2">${node.id}</td>
            <td class="px-4 py-2">${node.status}</td>
            <td class="px-4 py-2">${node.cpuUsage || '0'}%</td>
            <td class="px-4 py-2">${node.memoryUsage || '0'}%</td>
            <td class="px-4 py-2">${node.gpuUsage || 'N/A'}</td>
            <td class="px-4 py-2">${new Date(node.lastHeartbeat).toLocaleString()}</td>
        </tr>
    `).join('');
}

// Export functions for use in main dashboard
window.initWebSocket = initWebSocket;