const WebSocket = require('ws');
const WindowsClient = require('./client');

const client = new WindowsClient();
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

console.log('Starting Windows client...');

function connectToServer() {
    try {
        ws = new WebSocket('ws://localhost:3001/client');
        console.log('Attempting to connect to server...');

        ws.on('open', () => {
            console.log('Connected to WebSocket server');
            reconnectAttempts = 0;
            client.start();

            // Handle status updates
            client.on('statusUpdate', (data) => {
                console.log('Sending status update:', data);
                try {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(data));
                    } else {
                        console.error('WebSocket not ready for status update');
                    }
                } catch (error) {
                    console.error('Error sending status update:', error);
                }
            });

            // Handle performance updates
            client.on('performanceUpdate', (data) => {
                console.log('Sending performance update:', data);
                try {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(data));
                    } else {
                        console.error('WebSocket not ready for performance update');
                    }
                } catch (error) {
                    console.error('Error sending performance update:', error);
                }
            });

            // Send initial status update
            const initialStatus = {
                type: 'statusUpdate',
                data: {
                    nodeId: client.id,
                    status: 'connected',
                    resources: 'Initializing...'
                }
            };
            console.log('Sending initial status:', initialStatus);
            ws.send(JSON.stringify(initialStatus));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log('Received message:', message);
                
                if (message.type === 'requestUpdate') {
                    // Send immediate status update when requested
                    client.updateResourceUsage();
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });

        ws.on('close', () => {
            console.log('Disconnected from WebSocket server');
            client.stop();
            
            // Attempt to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                console.log(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY}ms...`);
                setTimeout(connectToServer, RECONNECT_DELAY);
            } else {
                console.error('Max reconnection attempts reached. Please restart the client.');
                process.exit(1);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

    } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY}ms...`);
            setTimeout(connectToServer, RECONNECT_DELAY);
        } else {
            console.error('Max reconnection attempts reached. Please restart the client.');
            process.exit(1);
        }
    }
}

// Start initial connection
connectToServer();

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down client...');
    client.stop();
    if (ws) {
        ws.close();
    }
    process.exit(0);
});

// Log any unhandled errors
process.on('uncaughtException', (error) => {
    console.error('Unhandled exception:', error);
});