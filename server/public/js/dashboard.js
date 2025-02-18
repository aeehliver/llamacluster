// WebSocket connection and dashboard functionality
let ws;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Initialize WebSocket connection
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        updateConnectionStatus('connected');
        reconnectAttempts = 0;
    };
    
    ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        updateConnectionStatus('disconnected');
        handleReconnection();
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus('error');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'nodeCount':
            updateNodeCount(data.count);
            break;
        case 'modelStatus':
            updateModelStatus(data.model);
            break;
        case 'clientStatus':
            updateClientStatus(data.clients);
            break;
        case 'error':
            showError(data.error);
            break;
    }
}

// Update UI elements
function updateNodeCount(count) {
    const nodeCountElement = document.getElementById('nodeCount');
    if (nodeCountElement) {
        nodeCountElement.textContent = count;
    }
}

function updateModelStatus(model) {
    const modelStatusElement = document.getElementById('modelStatus');
    if (modelStatusElement) {
        modelStatusElement.textContent = `Model: ${model.status} (${model.progress}%)`;
        modelStatusElement.className = `status-${model.status}`;
    }
}

function updateClientStatus(clients) {
    const clientListElement = document.getElementById('clientList');
    if (clientListElement) {
        clientListElement.innerHTML = '';
        clients.forEach(client => {
            const clientElement = document.createElement('div');
            clientElement.className = `client-item status-${client.status}`;
            clientElement.innerHTML = `
                <span class="client-id">${client.id}</span>
                <span class="client-status">${client.status}</span>
                <span class="client-uptime">${formatUptime(client.connectedAt)}</span>
            `;
            clientListElement.appendChild(clientElement);
        });
    }
}

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.className = `status-${status}`;
        statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
}

function showError(error) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = error;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

// Helper functions
function formatUptime(connectedAt) {
    const uptime = Date.now() - connectedAt;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function handleReconnection() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        setTimeout(() => {
            console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
            initWebSocket();
        }, delay);
    } else {
        console.error('Max reconnection attempts reached');
        showError('Unable to connect to server. Please refresh the page.');
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
});