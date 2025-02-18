# Tareas Pendientes

## Prioridad Alta

### Cliente Mac
- [ ] Depurar conexión WebSocket
- [ ] Verificar inicialización de MLX
- [ ] Corregir visualización en dashboard
- [ ] Implementar métricas de Neural Engine
- [ ] Probar carga del modelo
- [ ] Optimizar para Apple Silicon

### Rendimiento
- [ ] Implementar contador de tokens/segundo
- [ ] Optimizar velocidad de inferencia
- [ ] Añadir caché de resultados frecuentes
- [ ] Implementar compresión de mensajes WebSocket
- [ ] Medir y optimizar latencia de red

### Dashboard
- [ ] Mejorar visualización de recursos
- [ ] Añadir gráficos históricos
- [ ] Implementar tema oscuro
- [ ] Mejorar responsive design
- [ ] Añadir filtros de nodos

## Prioridad Media

### Funcionalidades
- [ ] Soporte para múltiples modelos
- [ ] Sistema de logs centralizado
- [ ] Auto-escalado de nodos
- [ ] Backup automático
- [ ] Gestión de errores mejorada

### Seguridad
- [ ] Implementar autenticación
- [ ] Cifrar comunicaciones
- [ ] Añadir control de acceso
- [ ] Sistema de auditoría
- [ ] Protección DDoS

### Testing
- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] Tests de carga
- [ ] Tests de seguridad
- [ ] Benchmarks automatizados

## Prioridad Baja

### Documentación
- [ ] Manual de usuario
- [ ] Guía de desarrollo
- [ ] Documentación de API
- [ ] Ejemplos de uso
- [ ] Guía de troubleshooting

### Mejoras UX
- [ ] Notificaciones en tiempo real
- [ ] Panel de administración
- [ ] Configuración vía UI
- [ ] Exportación de métricas
- [ ] Personalización de dashboard

### Optimizaciones
- [ ] Reducir uso de memoria
- [ ] Optimizar comunicación P2P
- [ ] Mejorar algoritmo de balanceo
- [ ] Optimizar queries de estado
- [ ] Reducir overhead de monitoreo

## Bugs Conocidos

1. **Cliente Mac**
   - No se visualiza en dashboard
   - Problemas de conexión WebSocket
   - Falta integración MLX

2. **Windows**
   - Ocasional pérdida de conexión P2P
   - Reinicio necesario tras largos períodos

3. **Dashboard**
   - Actualizaciones pueden causar parpadeo
   - Gráficos no se escalan correctamente

## Notas de Implementación

### Medición de Tokens/Segundo
```javascript
class TokenCounter {
    constructor() {
        this.startTime = null;
        this.tokenCount = 0;
        this.measurements = [];
    }

    start() {
        this.startTime = Date.now();
        this.tokenCount = 0;
    }

    addTokens(count) {
        this.tokenCount += count;
        const elapsed = (Date.now() - this.startTime) / 1000;
        const tokensPerSecond = this.tokenCount / elapsed;
        this.measurements.push(tokensPerSecond);
    }

    getAverage() {
        return this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;
    }
}
```

### Optimización de Memoria
```javascript
class MemoryOptimizer {
    constructor(maxCacheSize = 1000) {
        this.cache = new LRUCache(maxCacheSize);
        this.gcThreshold = 0.8; // 80% uso de memoria
    }

    monitor() {
        const used = process.memoryUsage();
        if (used.heapUsed / used.heapTotal > this.gcThreshold) {
            this.cleanup();
        }
    }

    cleanup() {
        this.cache.clear();
        global.gc(); // Requiere --expose-gc
    }
}
```

### Compresión de Mensajes
```javascript
class MessageCompressor {
    static compress(message) {
        // Implementar compresión de mensajes
        // Usar algoritmos como LZ4 o DEFLATE
    }

    static decompress(message) {
        // Implementar descompresión
    }
}
```
