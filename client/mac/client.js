const WebSocket = require('ws');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

class MacClient {
    constructor(serverUrl = 'ws://localhost:3000') {
        this.serverUrl = serverUrl;
        this.clientId = uuidv4();
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
    }

    connect() {
        try {
            this.ws = new WebSocket(this.serverUrl);

            this.ws.on('open', () => {
                console.log('Connected to server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.registerClient();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('Disconnected from server');
                this.isConnected = false;
                this.handleReconnect();
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

        } catch (error) {
            console.error('Connection error:', error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    registerClient() {
        const registrationData = {
            type: 'registration',
            clientId: this.clientId,
            platform: 'darwin',
            hostname: os.hostname(),
            specs: {
                cpus: os.cpus(),
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                platform: os.platform(),
                arch: os.arch()
            }
        };

        this.sendMessage(registrationData);
    }

    handleMessage(message) {
        switch (message.type) {
            case 'command':
                this.executeCommand(message.data);
                break;
            case 'ping':
                this.sendMessage({ type: 'pong' });
                break;
            default:
                console.log('Received message:', message);
        }
    }

    executeCommand(command) {
        // Implementation for executing commands will be added here
        console.log('Received command:', command);
    }

    sendMessage(data) {
        if (this.isConnected) {
            try {
                this.ws.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending message:', error);
            }
        } else {
            console.error('Not connected to server');
        }
    }
}

module.exports = MacClient;