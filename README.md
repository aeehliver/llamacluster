# Cluster LLaMA Distribuido

## Estado Actual del Proyecto

### ✅ Funcionalidades Comprobadas

1. **Nodos Windows**
   - Descubrimiento P2P entre nodos
   - Elección de líder automática
   - Conexión WebSocket con el servidor central
   - Monitoreo de recursos (CPU, RAM, GPU)
   - Distribución del modelo
   - Procesamiento de inferencias
   - Manejo de errores y reconexión
   - Monitoreo de VRAM y temperatura GPU

2. **Servidor Central**
   - API REST compatible con OpenAI
   - WebSocket para comunicación bidireccional
   - Dashboard en tiempo real
   - Balanceo de carga entre nodos
   - Manejo de desconexiones
   - Registro de estados y errores

3. **Dashboard**
   - Visualización de nodos activos
   - Monitoreo de recursos en tiempo real
   - Estado de carga del modelo
   - Diferenciación visual entre tipos de nodos
   - Actualización automática

### 🔧 En Desarrollo

1. **Cliente Mac (MLX)**
   - Integración con MLX para Apple Silicon
   - Monitoreo de Neural Engine
   - Adaptación del cliente para macOS
   - Visualización en dashboard
   - Métricas específicas de MLX

2. **Optimizaciones Pendientes**
   - Ajuste de velocidad de inferencia
   - Medición de tokens por segundo
   - Optimización de memoria
   - Caché de resultados
   - Compresión de comunicaciones

### 📋 Próximas Implementaciones

1. **Rendimiento**
   - Implementar medición de tokens/segundo
   - Optimizar velocidad de inferencia
   - Benchmark automático
   - Monitoreo de latencia
   - Caché de resultados frecuentes

2. **Diseño y UX**
   - Mejorar interfaz del dashboard
   - Gráficos de rendimiento histórico
   - Alertas y notificaciones
   - Temas claro/oscuro
   - Responsive design

3. **Funcionalidades**
   - Gestión de modelos múltiples
   - Auto-escalado de nodos
   - Backup y recuperación
   - Logs centralizados
   - Métricas avanzadas

4. **Seguridad**
   - Autenticación de nodos
   - Cifrado de comunicaciones
   - Control de acceso
   - Auditoría de uso
   - Protección contra ataques

## Guía de Instalación

### Windows
1. Instalar Node.js y Python
2. Configurar CUDA y drivers NVIDIA
3. Clonar el repositorio
4. Ejecutar `npm install` en cada directorio
5. Iniciar servidor: `cd server && node server-core.js`
6. Iniciar nodos: `cd client/windows-X && node index.js`

### Mac (En desarrollo)
1. Instalar Node.js y Python
2. Instalar MLX: `pip install mlx`
3. Clonar el repositorio
4. Ejecutar `npm install` en cada directorio
5. Dar permisos: `chmod +x start.sh`
6. Iniciar nodo: `./start.sh`

## Arquitectura

```
cluster/
├── server/              # Servidor central
│   ├── api/            # Endpoints REST
│   ├── public/         # Dashboard
│   └── server-core.js  # Núcleo del servidor
├── client/             # Clientes
│   ├── windows-1/      # Nodo Windows 1
│   ├── windows-2/      # Nodo Windows 2
│   └── mac-1/          # Nodo Mac (MLX)
└── test/               # Scripts de prueba
```

## Métricas de Rendimiento (Por implementar)

- Tokens por segundo por nodo
- Latencia de respuesta
- Uso de memoria por modelo
- Eficiencia de distribución
- Tiempo de carga del modelo
- Tasa de error
- Disponibilidad del sistema

## Contribución

1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Añadir nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.
