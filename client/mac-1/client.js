const EventEmitter = require('events');
const os = require('os');
const P2PDiscovery = require('./p2p-discovery');
const WebSocket = require('ws');
const GPUMonitor = require('./gpu-monitor');

class MacClient extends EventEmitter {
    constructor() {
        super();
        // Asegurar que el ID comience con 'mac-'
        const randomId = Math.random().toString(36).substr(2, 9);
        this.id = `mac-1-${randomId}`;
        
        console.log('=== Iniciando Cliente LLaMA para macOS ===');
        console.log(`ID del nodo: ${this.id}`);
        console.log(`Hostname: ${os.hostname()}`);
        console.log('======================================');

        this.status = 'initializing';
        this.resources = {
            cpu: 0,
            memory: 0,
            gpu: 0,
            gpuMemory: 0,
            gpuTemp: 0,
            mlxVersion: null
        };
        this.updateInterval = null;
        this.modelStatus = {
            status: 'unloaded',
            progress: 0,
            error: null,
            partition: null,
            currentRequest: null,
            backend: 'mlx'  // Especificar que usamos MLX
        };

        // Inicializar monitores
        this.gpuMonitor = new GPUMonitor();

        // Inicializar P2P Discovery
        this.discovery = new P2PDiscovery();
        this.setupP2PDiscovery();

        // Inicializar conexión al servidor
        this.ws = null;
        this.serverInfo = null;
    }

    setupP2PDiscovery() {
        this.discovery.on('peer-discovered', ({ nodeId, hostname }) => {
            console.log(`[P2P] Peer descubierto: ${hostname} (${nodeId})`);
            this.emit('peer-discovered', { nodeId, hostname });
        });

        this.discovery.on('leader-elected', ({ nodeId, isUs }) => {
            console.log(`[P2P] Líder elegido: ${nodeId}${isUs ? ' (nosotros)' : ''}`);
            if (isUs) {
                console.log('[P2P] Como soy el líder, iniciando distribución del modelo...');
                this.startModelDistribution();
            }
        });

        this.discovery.on('broadcast-received', ({ nodeId, data }) => {
            if (data.type === 'model-partition') {
                this.handleModelPartition(data);
            }
        });

        this.discovery.on('server-info', (info) => {
            console.log('[P2P] Información del servidor recibida:', info);
            this.serverInfo = info;
            this.setupWebSocket();
        });
    }

    setupWebSocket() {
        try {
            const wsUrl = `ws://${this.serverInfo.address}:${this.serverInfo.port}/client`;
            console.log('[WS] Intentando conectar a:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log('[WS] Conectado al servidor central');
                this.sendStatusUpdate();

                // Establecer intervalo de actualización de estado
                if (this.updateInterval) {
                    clearInterval(this.updateInterval);
                }
                this.updateInterval = setInterval(() => {
                    if (this.ws.readyState === WebSocket.OPEN) {
                        this.sendStatusUpdate();
                    }
                }, 5000);
            });

            this.ws.on('close', () => {
                console.log('[WS] Desconectado del servidor central');
                if (this.updateInterval) {
                    clearInterval(this.updateInterval);
                }
                setTimeout(() => this.setupWebSocket(), 5000);
            });

            this.ws.on('error', (error) => {
                console.error('[WS] Error de conexión:', error);
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
            console.error('[WS] Error al configurar WebSocket:', error);
            setTimeout(() => this.setupWebSocket(), 5000);
        }
    }

    sendStatusUpdate() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('[WS] No se puede enviar actualización: WebSocket no conectado');
            return;
        }

        const status = {
            type: 'statusUpdate',
            data: {
                nodeId: this.id,
                status: this.status,
                resources: this.getResourceInfo(),
                modelStatus: this.modelStatus
            }
        };

        try {
            console.log('[WS] Enviando actualización de estado:', JSON.stringify(status, null, 2));
            this.ws.send(JSON.stringify(status));
        } catch (error) {
            console.error('[WS] Error al enviar actualización:', error);
        }
    }

    start() {
        console.log('=== Iniciando servicios ===');
        this.status = 'connected';
        
        console.log('[P2P] Iniciando descubrimiento...');
        try {
            this.discovery.start();
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

        if (this.ws) {
            try {
                this.ws.close();
                console.log('[WS] Conexión cerrada');
            } catch (error) {
                console.error('[WS] Error al cerrar:', error);
            }
        }

        try {
            this.discovery.stop();
            console.log('[P2P] Descubrimiento detenido');
        } catch (error) {
            console.error('[P2P] Error al detener:', error);
        }

        console.log('==========================');
    }

    startResourceMonitoring() {
        this.updateInterval = setInterval(async () => {
            await this.updateResourceUsage();
            this.sendStatusUpdate();
        }, 5000);
    }

    async updateResourceUsage() {
        const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memUsage = ((totalMem - freeMem) / totalMem) * 100;

        this.resources = {
            cpu: Math.round(cpuUsage),
            memory: Math.round(memUsage)
        };

        const mlxInfo = await this.gpuMonitor.getMLXInfo();
        if (mlxInfo.available) {
            this.resources = {
                ...this.resources,
                gpu: mlxInfo.utilization,
                gpuMemory: mlxInfo.memoryUsedPercent,
                gpuDetails: {
                    memoryUsed: mlxInfo.memoryUsed,
                    memoryTotal: mlxInfo.memoryTotal,
                    temperature: mlxInfo.temperature
                },
                mlxVersion: mlxInfo.mlxVersion,
                neuroEngineActive: mlxInfo.neuroEngineActive,
                device: mlxInfo.device
            };
        }
    }

    getResourceInfo() {
        const mlxInfo = this.resources.mlxVersion ? 
            `MLX ${this.resources.mlxVersion} | ${this.resources.device} | Neural Engine: ${this.resources.neuroEngineActive ? 'Active' : 'Inactive'}` :
            'MLX: No disponible';

        const gpuInfo = this.resources.gpuDetails ? 
            `Memoria: ${this.resources.gpuMemory}% (${this.resources.gpuDetails.memoryUsed}/${this.resources.gpuDetails.memoryTotal}MB) | ${this.resources.gpuDetails.temperature}°C` :
            'GPU: No disponible';

        return `CPU: ${this.resources.cpu}% | MEM: ${this.resources.memory}% | ${mlxInfo} | ${gpuInfo}`;
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
            partition: partition,
            backend: 'mlx'  // Especificar que usamos MLX
        };

        const loadInterval = setInterval(() => {
            this.modelStatus.progress += 25;
            
            console.log(`[Modelo] Cargando partición ${partition.partitionId} con MLX: ${this.modelStatus.progress}%`);
            
            if (this.modelStatus.progress >= 100) {
                clearInterval(loadInterval);
                this.modelStatus.status = 'loaded';
                console.log(`[Modelo] Partición ${partition.partitionId} cargada completamente en MLX`);
                
                this.sendStatusUpdate();
            }
            
            this.sendStatusUpdate();
        }, 500);
    }

    async handleInference(request) {
        const { requestId, messages, temperature, max_tokens } = request;
        
        if (this.modelStatus.status !== 'loaded') {
            return {
                type: 'inference_response',
                data: {
                    requestId,
                    error: 'Modelo MLX no cargado'
                }
            };
        }

        if (this.modelStatus.currentRequest) {
            return {
                type: 'inference_response',
                data: {
                    requestId,
                    error: 'Nodo MLX ocupado'
                }
            };
        }

        try {
            this.modelStatus.currentRequest = requestId;
            console.log(`[MLX] Procesando solicitud ${requestId}`);

            // Simular procesamiento del modelo con MLX
            const response = await new Promise((resolve) => {
                const words = ['Hola', 'mundo', 'esto', 'es', 'una', 'prueba', 'del', 'modelo', 'MLX'];
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

            console.log(`[MLX] Completada solicitud ${requestId}`);
            this.modelStatus.currentRequest = null;
            this.sendStatusUpdate();

            return {
                type: 'inference_response',
                data: {
                    requestId,
                    text: response,
                    finish_reason: 'length',
                    backend: 'mlx'  // Indicar que la respuesta viene de MLX
                }
            };

        } catch (error) {
            console.error(`[MLX] Error procesando solicitud ${requestId}:`, error);
            this.modelStatus.currentRequest = null;
            this.sendStatusUpdate();

            return {
                type: 'inference_response',
                data: {
                    requestId,
                    error: error.message || 'Error interno del modelo MLX'
                }
            };
        }
    }
}

module.exports = MacClient;
