const dgram = require('dgram');
const { EventEmitter } = require('events');
const os = require('os');
const crypto = require('crypto');

class P2PDiscovery extends EventEmitter {
    constructor(port = 34399) {
        super();
        this.port = port;
        this.nodeId = crypto.randomBytes(8).toString('hex');
        this.peers = new Map();
        this.socket = null;
        this.isRunning = false;
        this.heartbeatInterval = null;
        this.cleanupInterval = null;
        this.hostname = os.hostname();
        this.currentLeader = null;
    }

    start() {
        if (this.isRunning) {
            console.log('P2P Discovery ya está en ejecución');
            return;
        }

        try {
            this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
            
            this.socket.on('error', (err) => {
                console.error('Error en socket UDP:', err);
                this.emit('error', err);
            });

            this.socket.on('message', (msg, rinfo) => {
                try {
                    const message = JSON.parse(msg);
                    this.handleMessage(message, rinfo);
                } catch (error) {
                    console.error('Error procesando mensaje:', error);
                }
            });

            this.socket.on('listening', () => {
                const address = this.socket.address();
                console.log(`Socket UDP vinculado al puerto ${address.port}`);
                
                // Habilitar broadcast
                this.socket.setBroadcast(true);
                
                // Iniciar heartbeat
                this.startHeartbeat();
                
                // Iniciar limpieza de peers inactivos
                this.startCleanup();
                
                this.isRunning = true;
                console.log('P2P Discovery iniciado correctamente');
                
                // Convertirnos en líder inmediatamente si estamos solos
                console.log('Asumiendo rol de líder inicial');
                this.currentLeader = this.nodeId;
                this.emit('leader-elected', { nodeId: this.nodeId, isUs: true });
            });

            // Vincular socket
            this.socket.bind(this.port);

        } catch (error) {
            console.error('Error iniciando P2P Discovery:', error);
            this.emit('error', error);
        }
    }

    stop() {
        if (!this.isRunning) {
            console.log('P2P Discovery no está en ejecución');
            return;
        }

        try {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }

            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }

            if (this.socket) {
                this.socket.close();
            }

            this.isRunning = false;
            this.peers.clear();
            console.log('P2P Discovery detenido correctamente');

        } catch (error) {
            console.error('Error deteniendo P2P Discovery:', error);
            this.emit('error', error);
        }
    }

    broadcast(message) {
        if (!this.isRunning || !this.socket) {
            console.error('No se puede transmitir: P2P Discovery no está en ejecución');
            return;
        }

        try {
            const broadcastMessage = {
                type: 'broadcast',
                nodeId: this.nodeId,
                hostname: this.hostname,
                timestamp: Date.now(),
                data: message
            };

            const buffer = Buffer.from(JSON.stringify(broadcastMessage));
            
            // Enviar a todas las interfaces de red
            const interfaces = os.networkInterfaces();
            Object.values(interfaces).forEach(iface => {
                iface.forEach(addr => {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        const broadcastAddr = this.getBroadcastAddress(addr.address, addr.netmask);
                        this.socket.send(buffer, 0, buffer.length, this.port, broadcastAddr);
                    }
                });
            });
            
            console.log('Mensaje broadcast enviado a la red');
        } catch (error) {
            console.error('Error enviando broadcast:', error);
            this.emit('error', error);
        }
    }

    getBroadcastAddress(ip, netmask) {
        const ipBytes = ip.split('.').map(Number);
        const maskBytes = netmask.split('.').map(Number);
        const broadcastBytes = ipBytes.map((byte, i) => (byte | (~maskBytes[i] & 255)));
        return broadcastBytes.join('.');
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isRunning && this.socket) {
                const heartbeat = {
                    type: 'heartbeat',
                    nodeId: this.nodeId,
                    hostname: this.hostname,
                    timestamp: Date.now()
                };

                this.broadcast(heartbeat);
            }
        }, 5000);
    }

    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            let peersChanged = false;

            for (const [nodeId, peer] of this.peers.entries()) {
                if (now - peer.lastSeen > 15000) {
                    console.log(`Peer ${nodeId} (${peer.hostname}) marcado como inactivo`);
                    this.peers.delete(nodeId);
                    this.emit('peer-lost', { nodeId, hostname: peer.hostname });
                    peersChanged = true;
                }
            }

            if (peersChanged) {
                this.updateLeader();
            }
        }, 5000);
    }

    handleMessage(message, rinfo) {
        if (message.nodeId === this.nodeId) return;

        const peer = {
            nodeId: message.nodeId,
            hostname: message.hostname,
            address: rinfo.address,
            lastSeen: Date.now()
        };

        const isNewPeer = !this.peers.has(message.nodeId);
        this.peers.set(message.nodeId, peer);

        if (isNewPeer) {
            console.log(`Nuevo peer descubierto: ${peer.hostname} (${peer.nodeId})`);
            this.emit('peer-discovered', { nodeId: message.nodeId, hostname: message.hostname });
            this.updateLeader();
        }

        if (message.type === 'broadcast') {
            this.emit('broadcast-received', {
                nodeId: message.nodeId,
                hostname: message.hostname,
                data: message.data
            });
        }
    }

    updateLeader() {
        const sortedPeers = Array.from(this.peers.keys()).sort();
        const leader = sortedPeers[0] || this.nodeId;
        
        if (this.currentLeader !== leader) {
            this.currentLeader = leader;
            const isUs = leader === this.nodeId;
            console.log(`Nuevo líder elegido: ${leader}${isUs ? ' (nosotros)' : ''}`);
            this.emit('leader-elected', { nodeId: leader, isUs });
        }
    }

    getPeers() {
        return Array.from(this.peers.values());
    }

    isClusterLeader() {
        return this.currentLeader === this.nodeId;
    }
}

module.exports = P2PDiscovery;
