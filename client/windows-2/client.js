const EventEmitter = require('events');
const os = require('os');
const P2PDiscovery = require('./p2p-discovery');
const WebSocket = require('ws');
const GPUMonitor = require('./gpu-monitor');

class WindowsClient extends EventEmitter {
    constructor() {
        super();
        this.id = `windows-2-${Math.random().toString(36).substr(2, 9)}`;
        console.log('=== Iniciando Cliente LLaMA ===');
        console.log(`ID del nodo: ${this.id}`);
        console.log(`Hostname: ${os.hostname()}`);
        console.log('==============================');

        this.status = 'initializing';
        this.resources = {
            cpu: 0,
            memory: 0,
            gpu: 0,
            gpuMemory: 0,
            gpuTemp: 0
        };
        this.updateInterval = null;
        this.modelStatus = {
            status: 'unloaded',
            progress: 0,
            error: null,
            partition: null,
            currentRequest: null
        };

        // Inicializar monitores
        this.gpuMonitor = new GPUMonitor();

        // Inicializar P2P Discovery
        this.discovery = new P2PDiscovery();
        this.setupP2PDiscovery();

        // Inicializar conexión al servidor
        this.ws = null;
        this.serverInfo = null;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 5;
        this.RECONNECT_DELAY = 3000;
    }

    setupP2PDiscovery() {
        this.discovery.on('peer-discovered', ({ nodeId, hostname }) => {
            console.log(`[P2P] Peer descubierto: ${hostname} (${nodeId})`);
            this.emit('peer-discovered', { nodeId, hostname });
        });

        this.discovery.on('peer-lost', ({ nodeId }) => {
            console.log(`[P2P] Peer perdido: ${nodeId}`);
            this.emit('peer-lost', { nodeId });
        });

        this.discovery.on('leader-elected', ({ nodeId }) => {
            const isUs = nodeId === this.id;
            console.log(`[P2P] Líder elegido: ${nodeId}${isUs ? ' (este nodo)' : ''}`);
            this.emit('leader-elected', { nodeId });
            
            if (this.discovery.isClusterLeader()) {
                this.startModelDistribution();
            }
        });

        this.discovery.on('broadcast-received', ({ nodeId, data }) => {
            if (data.type === 'model-partition') {
                this.handleModelPartition(data);
            } else if (data.type === 'server-info') {
                console.log('[P2P] Información del servidor recibida:', data.data);
                this.serverInfo = data.data;
                this.connectToServer();
            }
        });

        this.discovery.on('error', (error) => {
            console.error('[P2P] Error:', error);
        });
    }

    connectToServer() {
        if (!this.serverInfo) {
            console.log('[WS] Esperando información del servidor...');
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[WS] Ya conectado al servidor');
            return;
        }

        this.setupWebSocket();
    }

    setupWebSocket() {
        try {
            console.log(`[WS] Conectando al servidor en: ws://${this.serverInfo.address}:${this.serverInfo.port}/client`);
            this.ws = new WebSocket(`ws://${this.serverInfo.address}:${this.serverInfo.port}/client`);

            this.ws.on('open', () => {
                console.log('[WS] Conectado al servidor central');
                this.sendStatusUpdate();
            });

            this.ws.on('close', () => {
                console.log('[WS] Desconectado del servidor central');
                setTimeout(() => this.setupWebSocket(), 5000);
            });

            this.ws.on('error', (error) => {
                console.error('[WS] Error:', error);
            });

            this.ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log('[WS] Mensaje recibido:', message.type);

                    if (message.type === 'inference') {
                        const response = await this.handleInference(message.data);
                        console.log('[WS] Enviando respuesta de inferencia:', response);
                        if (this.ws.readyState === WebSocket.OPEN) {
                            this.ws.send(JSON.stringify(response));
                        }
                    }
                } catch (error) {
                    console.error('[WS] Error procesando mensaje:', error);
                }
            });

        } catch (error) {
            console.error('[WS] Error al conectar:', error);
            setTimeout(() => this.setupWebSocket(), 5000);
        }
    }

    async handleInference(request) {
        const { requestId, messages, temperature, max_tokens } = request;
        
        if (this.modelStatus.status !== 'loaded') {
            return {
                type: 'inference_response',
                data: {
                    requestId,
                    error: 'Modelo no cargado'
                }
            };
        }

        if (this.modelStatus.currentRequest) {
            return {
                type: 'inference_response',
                data: {
                    requestId,
                    error: 'Nodo ocupado'
                }
            };
        }

        try {
            this.modelStatus.currentRequest = requestId;
            console.log(`[Modelo] Procesando solicitud ${requestId}`);

            // Simular procesamiento del modelo
            const response = await new Promise((resolve) => {
                const words = ['Hola', 'mundo', 'esto', 'es', 'una', 'prueba', 'del', 'modelo', 'distribuido'];
                let text = '';
                let i = 0;
                
                const interval = setInterval(() => {
                    if (i >= words.length || i >= max_tokens / 10) {
                        clearInterval(interval);
                        resolve(text);
                    } else {
                        text += words[i] + ' ';
                        i++;
                    }
                }, 500);
            });

            console.log(`[Modelo] Completada solicitud ${requestId}`);
            this.modelStatus.currentRequest = null;
            this.sendStatusUpdate();

            return {
                type: 'inference_response',
                data: {
                    requestId,
                    text: response,
                    finish_reason: 'length'
                }
            };

        } catch (error) {
            console.error(`[Modelo] Error procesando solicitud ${requestId}:`, error);
            this.modelStatus.currentRequest = null;
            this.sendStatusUpdate();

            return {
                type: 'inference_response',
                data: {
                    requestId,
                    error: error.message || 'Error interno del modelo'
                }
            };
        }
    }

    sendStatusUpdate() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const status = {
                type: 'statusUpdate',
                data: {
                    nodeId: this.id,
                    status: this.status,
                    resources: this.getResourceInfo(),
                    modelStatus: this.modelStatus  // Incluir estado del modelo
                }
            };
            this.ws.send(JSON.stringify(status));
            console.log('[WS] Estado enviado al servidor:', status.data);
        }
    }

    start() {
        console.log('=== Iniciando servicios ===');
        this.status = 'connected';
        
        console.log('[P2P] Iniciando descubrimiento...');
        try {
            this.discovery.start();
            
            // Iniciar distribución del modelo si somos el líder
            if (this.isLeader()) {
                console.log('[Modelo] Soy el líder del cluster, iniciando distribución del modelo...');
                setTimeout(() => this.startModelDistribution(), 5000); // Esperar 5 segundos para que los nodos se descubran
            }
        } catch (error) {
            console.error('[P2P] Error al iniciar:', error);
        }

        console.log('[Monitor] Iniciando monitoreo de recursos...');
        this.startResourceMonitoring();
        
        console.log('=========================');
    }

    stop() {
        console.log('=== Deteniendo servicios ===');
        this.status = 'disconnected';
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            console.log('[Monitor] Monitoreo detenido');
        }

        console.log('[P2P] Deteniendo descubrimiento...');
        try {
            this.discovery.stop();
        } catch (error) {
            console.error('[P2P] Error al detener:', error);
        }

        if (this.ws) {
            try {
                this.ws.close();
                console.log('[WS] Conexión cerrada');
            } catch (error) {
                console.error('[WS] Error al cerrar:', error);
            }
        }

        console.log('==========================');
    }

    startResourceMonitoring() {
        this.updateInterval = setInterval(() => {
            this.updateResourceUsage();
        }, 5000);
    }

    async updateResourceUsage() {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();

        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

        const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

        // Obtener información de la GPU
        const gpuInfo = await this.gpuMonitor.getGPUInfo();
        
        this.resources = {
            cpu: Math.round(cpuUsage),
            memory: Math.round(memoryUsage),
            gpu: gpuInfo.available ? gpuInfo.utilization : 0,
            gpuMemory: gpuInfo.available ? gpuInfo.memoryUsedPercent : 0,
            gpuTemp: gpuInfo.available ? gpuInfo.temperature : 0,
            gpuDetails: gpuInfo.available ? {
                memoryUsed: gpuInfo.memoryUsed,
                memoryTotal: gpuInfo.memoryTotal,
                temperature: gpuInfo.temperature
            } : null
        };

        this.sendStatusUpdate();

        this.emit('performanceUpdate', {
            type: 'performanceUpdate',
            data: this.resources
        });
    }

    getResourceInfo() {
        const gpuInfo = this.resources.gpuDetails ? 
            `GPU: ${this.resources.gpu}% | VRAM: ${this.resources.gpuMemory}% (${this.resources.gpuDetails.memoryUsed}/${this.resources.gpuDetails.memoryTotal}MB) | ${this.resources.gpuDetails.temperature}°C` :
            'GPU: No disponible';

        return `CPU: ${this.resources.cpu}% | MEM: ${this.resources.memory}% | ${gpuInfo}`;
    }

    startModelDistribution() {
        if (!this.discovery.isClusterLeader()) return;

        const peers = this.discovery.getPeers();
        const totalPeers = peers.length + 1;
        
        console.log(`[Modelo] Iniciando distribución entre ${totalPeers} nodos`);

        peers.forEach((peer, index) => {
            const partition = {
                type: 'model-partition',
                partitionId: index + 1,
                totalPartitions: totalPeers,
                size: Math.floor(100 / totalPeers)
            };

            this.discovery.broadcast(partition);
            console.log(`[Modelo] Enviada partición ${index + 1} a ${peer.hostname}`);
        });

        this.handleModelPartition({
            partitionId: 0,
            totalPartitions: totalPeers,
            size: Math.floor(100 / totalPeers)
        });
    }

    handleModelPartition(partition) {
        console.log(`[Modelo] Recibida partición ${partition.partitionId}/${partition.totalPartitions}`);
        
        this.modelStatus = {
            status: 'loading',
            progress: 0,
            partition: partition
        };

        const loadInterval = setInterval(() => {
            this.modelStatus.progress += 10;
            
            if (this.modelStatus.progress >= 100) {
                clearInterval(loadInterval);
                this.modelStatus.status = 'loaded';
                console.log(`[Modelo] Partición ${partition.partitionId} cargada completamente`);
            }

            console.log(`[Modelo] Cargando partición ${partition.partitionId}: ${this.modelStatus.progress}%`);
            this.emit('modelStatusUpdate', {
                type: 'modelStatusUpdate',
                data: this.modelStatus
            });
        }, 1000);
    }

    getPeers() {
        return this.discovery.getPeers();
    }

    isLeader() {
        return this.discovery.isClusterLeader();
    }
}

module.exports = WindowsClient;