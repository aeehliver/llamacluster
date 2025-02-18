const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const config = require('./config/config.json');
const P2PDiscovery = require('../client/windows-1/p2p-discovery');

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize HTTP server
const server = http.createServer(app);

// Initialize WebSocket server with heartbeat
const wss = new WebSocket.Server({ 
    server,
    clientTracking: true
});

// Initialize P2P Discovery
const discovery = new P2PDiscovery();
discovery.on('peer-discovered', ({ nodeId, hostname }) => {
    console.log(`Nodo descubierto: ${hostname} (${nodeId})`);
    // Broadcast server info to the newly discovered peer
    discovery.broadcast({
        type: 'server-info',
        data: {
            address: getServerAddress(),
            port: config.port
        }
    });
});

// Store connected clients and their info
const clients = new Map();
let dashboardClient = null;

function noop() {}

function heartbeat() {
    this.isAlive = true;
}

function getServerAddress() {
    const interfaces = require('os').networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address;
            }
        }
    }
    return 'localhost';
}

// Broadcast to all dashboard clients
function broadcast(data) {
    console.log('Broadcasting data:', data);
    if (dashboardClient && dashboardClient.readyState === WebSocket.OPEN) {
        try {
            dashboardClient.send(JSON.stringify(data));
        } catch (error) {
            console.error('Error broadcasting:', error);
        }
    } else {
        console.log('No dashboard client connected or client not ready');
    }
}

// Initialize API routes
const registrationRoutes = require('./api/registration');
const modelRoutes = require('./api/model');
const clusterRoutes = require('./api/cluster');
const commandRoutes = require('./api/command');
const logsRoutes = require('./api/logs');
const modelDistributionRoutes = require('./api/model-distribution');
const llamaApi = require('./api/llama-api');

// Apply routes
app.use('/api/registration', registrationRoutes);
app.use('/api/model', modelRoutes);
app.use('/api/cluster', clusterRoutes);
app.use('/api/command', commandRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/model-distribution', modelDistributionRoutes);
app.use('/', llamaApi.router);

// Make clients available to routes
app.locals.clients = clients;

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log('[WS] Nueva conexión desde:', ip);
    console.log('[WS] URL de conexión:', req.url);
    
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    
    // Check if this is a dashboard connection
    const isDashboard = req.url === '/' || req.url === '';
    
    if (isDashboard) {
        console.log('[WS] Cliente dashboard conectado');
        dashboardClient = ws;
        
        // Send initial state
        const initialState = {
            type: 'initialState',
            data: {
                totalNodes: clients.size,
                activeNodes: Array.from(clients.values()).filter(c => c.status === 'connected').length,
                nodes: Array.from(clients.values()).map(client => ({
                    nodeId: client.nodeId,
                    status: client.status,
                    resources: client.resources,
                    modelStatus: client.modelStatus
                }))
            }
        };
        console.log('[WS] Enviando estado inicial al dashboard:', JSON.stringify(initialState, null, 2));
        ws.send(JSON.stringify(initialState));
    } else {
        // This is a cluster node client
        console.log('[WS] Cliente nodo conectado');
        let clientId = null;

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                console.log('[WS] Recibido del cliente:', JSON.stringify(data, null, 2));

                switch (data.type) {
                    case 'statusUpdate':
                        clientId = data.data.nodeId;
                        clients.set(clientId, {
                            nodeId: data.data.nodeId,
                            status: data.data.status,
                            resources: data.data.resources,
                            lastUpdate: Date.now(),
                            ws: ws,
                            modelStatus: data.data.modelStatus,
                            performance: data.data.resources
                        });
                        console.log('[WS] Estado del cliente actualizado:', {
                            nodeId: data.data.nodeId,
                            status: data.data.status,
                            resources: data.data.resources,
                            modelStatus: data.data.modelStatus
                        });

                        // Broadcast node status to dashboard
                        broadcast({
                            type: 'nodeStatus',
                            data: {
                                nodeId: data.data.nodeId,
                                status: data.data.status,
                                resources: data.data.resources,
                                modelStatus: data.data.modelStatus
                            }
                        });
                        break;

                    case 'inference_response':
                        llamaApi.handleNodeResponse(clientId, data);
                        break;
                }

                // Send updated node count
                broadcast({
                    type: 'nodeCount',
                    data: {
                        total: clients.size,
                        active: Array.from(clients.values()).filter(c => c.status === 'connected').length
                    }
                });

            } catch (error) {
                console.error('[WS] Error procesando mensaje:', error);
            }
        });

        ws.on('close', () => {
            console.log('[WS] Cliente desconectado:', clientId);
            if (clientId) {
                clients.delete(clientId);
                broadcast({
                    type: 'nodeStatus',
                    data: {
                        nodeId: clientId,
                        status: 'disconnected',
                        resources: null
                    }
                });
            }
        });
    }

    ws.on('error', (error) => {
        console.error('[WS] Error:', error);
    });
});

// Heartbeat interval
const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) {
            console.log('Client failed heartbeat, terminating connection');
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping(noop);
    });
}, 30000);

wss.on('close', function close() {
    clearInterval(interval);
    discovery.stop();
});

// Start server and P2P Discovery
server.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running on port ${config.port}`);
    console.log('Server is listening on all network interfaces');
    
    // Start P2P Discovery after server is running
    discovery.start();
    console.log('P2P Discovery started');
});

// Error handling
process.on('unhandledRejection', (err) => {
    console.error('Unhandled promise rejection:', err);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    discovery.stop();
    wss.close();
    server.close();
    process.exit(0);
});