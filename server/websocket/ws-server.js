const WebSocket = require('ws');
const crypto = require('crypto');

class WebSocketServer {
    constructor(server, options = {}) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map();
        this.heartbeatInterval = options.heartbeatInterval || 30000;
        this.setupHeartbeat();
        this.setupMessageHandlers();
        this.setupStatusBroadcast();
    }

    setupStatusBroadcast() {
        setInterval(() => {
            this.broadcastClientStatus();
        }, 5000);
    }

    broadcastClientStatus() {
        const clientsStatus = Array.from(this.clients.entries()).map(([id, client]) => ({
            id,
            status: client.ws.isAlive ? 'active' : 'inactive',
            connectedAt: client.metadata.connectedAt,
            modelStatus: client.metadata.modelStatus
        }));

        this.broadcastToAll({
            type: 'clientStatus',
            clients: clientsStatus
        });
    }

    setupHeartbeat() {
        setInterval(() => {
            this.clients.forEach((client, id) => {
                if (client.ws.isAlive === false) {
                    client.ws.terminate();
                    this.clients.delete(id);
                    return;
                }
                client.ws.isAlive = false;
                client.ws.ping();
            });
        }, this.heartbeatInterval);
    }

    setupMessageHandlers() {
        this.wss.on('connection', (ws) => {
            const clientId = crypto.randomBytes(16).toString('hex');
            ws.isAlive = true;

            this.clients.set(clientId, {
                ws,
                metadata: {
                    connectedAt: Date.now(),
                    lastMessageAt: Date.now(),
                    modelStatus: {
                        status: 'unloaded',
                        progress: 0,
                        error: null
                    }
                }
            });

            // Broadcast updated node count to all clients
            this.broadcastNodeCount();

            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(clientId, data);
                } catch (error) {
                    console.error('Error processing message:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Invalid message format'
                    }));
                }
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
                console.log(`Client ${clientId} disconnected`);
                // Broadcast updated node count after disconnection
                this.broadcastNodeCount();
            });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connection',
                clientId,
                message: 'Connected to WebSocket server'
            }));
        });
    }

    handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.metadata.lastMessageAt = Date.now();

        switch (data.type) {
            case 'heartbeat':
                this.handleHeartbeat(clientId, data);
                break;
            case 'model-status-update':
                this.handleModelStatusUpdate(clientId, data);
                // Broadcast model status to all clients
                this.broadcastToAll({
                    type: 'modelStatus',
                    model: data.model
                });
                break;
            case 'status':
                this.handleStatusUpdate(clientId, data);
                // Broadcast node status to all clients
                this.broadcastNodeStatus();
                break;
            case 'command':
                this.handleCommand(clientId, data);
                break;
            default:
                client.ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Unknown message type'
                }));
        }
    }

    handleModelStatusUpdate(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Update client's model status
        client.metadata.modelStatus = data.status;

        // Broadcast model status update to all clients
        this.broadcastToAll({
            type: 'model-status-update',
            clientId,
            status: data.status
        });
    }

    handleInferenceMetrics(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Broadcast inference metrics to all clients
        this.broadcastToAll({
            type: 'inference-metrics',
            clientId,
            metrics: {
                duration: data.duration,
                timestamp: data.timestamp
            }
        });
    }

    broadcastToAll(message) {
        this.clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        });
    }

    broadcastNodeCount() {
        this.broadcastToAll({
            type: 'node-count',
            count: this.clients.size
        });
    }
}

module.exports = WebSocketServer;