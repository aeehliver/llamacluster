const { exec } = require('child_process');
const os = require('os');

class GPUMonitor {
    constructor() {
        this.hasNvidia = false;
        this.checkNvidiaGPU();
    }

    checkNvidiaGPU() {
        exec('nvidia-smi --query-gpu=gpu_name --format=csv,noheader', (error, stdout, stderr) => {
            if (!error) {
                this.hasNvidia = true;
                console.log('[GPU] GPU NVIDIA detectada:', stdout.trim());
            } else {
                console.log('[GPU] No se detectó GPU NVIDIA o nvidia-smi no está disponible');
                this.hasNvidia = false;
            }
        });
    }

    async getGPUInfo() {
        if (!this.hasNvidia) {
            return {
                available: false,
                error: 'No se detectó GPU NVIDIA'
            };
        }

        try {
            const [memoryInfo, utilizationInfo] = await Promise.all([
                this.executeNvidiaSmi('memory.used,memory.total'),
                this.executeNvidiaSmi('utilization.gpu,temperature.gpu')
            ]);

            const [memUsed, memTotal] = memoryInfo.split(',').map(x => parseInt(x));
            const [utilization, temperature] = utilizationInfo.split(',').map(x => parseInt(x));

            return {
                available: true,
                memoryUsed: memUsed,    // MB
                memoryTotal: memTotal,  // MB
                utilization: utilization, // %
                temperature: temperature, // °C
                memoryUsedPercent: Math.round((memUsed / memTotal) * 100)
            };
        } catch (error) {
            console.error('[GPU] Error obteniendo información de la GPU:', error);
            return {
                available: false,
                error: error.message
            };
        }
    }

    executeNvidiaSmi(query) {
        return new Promise((resolve, reject) => {
            exec(`nvidia-smi --query-gpu=${query} --format=csv,noheader,nounits`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }

    async getResourceInfo() {
        const gpuInfo = await this.getGPUInfo();
        if (!gpuInfo.available) {
            return 'GPU: No disponible';
        }

        return `GPU: ${gpuInfo.utilization}% | VRAM: ${gpuInfo.memoryUsedPercent}% (${gpuInfo.memoryUsed}/${gpuInfo.memoryTotal}MB) | ${gpuInfo.temperature}°C`;
    }
}

module.exports = GPUMonitor;
