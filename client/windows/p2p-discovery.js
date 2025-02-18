const dgram = require('dgram');
const { EventEmitter } = require('events');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

class P2PDiscovery extends EventEmitter {
    constructor(startPort = 33445) {
        super();
        this.startPort = startPort;
        this.port = null;
        this.nodeId = uuidv4();
        this.peers = new Map();
        this.socket = dgram.createSocket('udp4');
        this.isLeader = false;
        this.leaderNodeId = null;
        this.setupSocket();
    }

    async bindToAvailablePort() {
        const maxAttempts = 100;
        let attempt = 0;

        while (attempt < maxAttempts) {
            const randomPort = this.startPort + Math.floor(Math.random() * 1000);
            try {
                await new Promise((resolve, reject) => {
                    const newSocket = dgram.createSocket('udp4');
                    newSocket.once('error', (err) => {
                        newSocket.close();
                        reject(err);
                    });

                    newSocket.bind(randomPort, () => {
                        this.socket = newSocket;
                        this.port = randomPort;
                        this.setupSocket();
                        resolve();
                    });
                });
                console.log(`Successfully bound to port ${this.port}`);
                return;
            } catch (err) {
                if (err.code !== 'EADDRINUSE') throw err;
                console.log(`Port ${randomPort} in use, trying another random port...`);
            }
            attempt++;
        }
        throw new Error('No available ports found after maximum attempts');
    }

    setupSocket() {
        this.socket.on('error', (err) => {
            console.error(`UDP Socket error: ${err}`);
            this.socket.close();
        });

        this.socket.on('message', (msg, rinfo) => {
            try {
                const message = JSON.parse(msg);
                this.handleMessage(message, rinfo);
            } catch (err) {
                console.error('Error processing message:', err);
            }
        });

        this.socket.on('listening', () => {
            this.socket.setBroadcast(true);
            console.log(`P2P Discovery listening on port ${this.port}`);
            this.startDiscovery();
        });
    }

    async start() {
        await this.bindToAvailablePort();
        setInterval(() => this.announcePresence(), 5000);
        setInterval(() => this.checkPeersHealth(), 10000);
    }

    stop() {
        this.socket.close();
    }

    startDiscovery() {
        // Only start discovery if we have a valid port
        if (this.port !== null && this.port > 0) {
            this.announcePresence();
            this.initiateLeaderElection();
        }
    }

    announcePresence() {
        const announcement = {
            type: 'announce',
            nodeId: this.nodeId,
            hostname: os.hostname(),
            timestamp: Date.now()
        };

        this.broadcast(announcement);
    }

    handleMessage(message, rinfo) {
        const { type, nodeId } = message;

        switch (type) {
            case 'announce':
                this.handleAnnouncement(message, rinfo);
                break;
            case 'leader_election':
                this.handleLeaderElection(message);
                break;
            case 'leader_elected':
                this.handleLeaderElected(message);
                break;
        }
    }

    handleAnnouncement(message, rinfo) {
        const { nodeId, hostname, timestamp } = message;
        if (nodeId !== this.nodeId) {
            this.peers.set(nodeId, {
                nodeId,
                hostname,
                address: rinfo.address,
                port: rinfo.port,
                lastSeen: timestamp
            });
            this.emit('peer-discovered', { nodeId, hostname });
        }
    }

    initiateLeaderElection() {
        const election = {
            type: 'leader_election',
            nodeId: this.nodeId,
            priority: Math.random() // Simple random priority
        };
        this.broadcast(election);
    }

    handleLeaderElection(message) {
        const { nodeId, priority } = message;
        // Higher priority wins
        if (priority > Math.random()) {
            this.leaderNodeId = nodeId;
            this.isLeader = (nodeId === this.nodeId);
            this.broadcast({
                type: 'leader_elected',
                nodeId: this.leaderNodeId
            });
        }
    }

    handleLeaderElected(message) {
        this.leaderNodeId = message.nodeId;
        this.isLeader = (message.nodeId === this.nodeId);
        this.emit('leader-elected', { nodeId: message.nodeId });
    }

    checkPeersHealth() {
        const now = Date.now();
        for (const [nodeId, peer] of this.peers.entries()) {
            if (now - peer.lastSeen > 15000) { // 15 seconds timeout
                this.peers.delete(nodeId);
                this.emit('peer-lost', { nodeId });
                if (nodeId === this.leaderNodeId) {
                    this.initiateLeaderElection();
                }
            }
        }
    }

    broadcast(message) {
        const data = Buffer.from(JSON.stringify(message));
        if (this.port) {
            // Use the same port that we're bound to for broadcasting
            this.socket.send(data, 0, data.length, this.port, '255.255.255.255');
        }
    }

    getPeers() {
        return Array.from(this.peers.values());
    }

    isClusterLeader() {
        return this.isLeader;
    }
}

module.exports = P2PDiscovery;