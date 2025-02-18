# Cliente LLaMA para macOS

Este cliente está diseñado específicamente para macOS y utiliza MLX para la inferencia del modelo LLaMA.

## Requisitos

- macOS con Apple Silicon (M1/M2/M3)
- Node.js 18 o superior
- Python 3.8 o superior
- MLX instalado (`pip install mlx`)

## Instalación

1. Instalar MLX:
```bash
pip install mlx
```

2. Instalar dependencias de Node.js:
```bash
npm install
```

## Ejecución

```bash
node index.js
```

## Características

- Utiliza MLX para inferencia optimizada en Apple Silicon
- Aprovecha la Neural Engine y GPU de manera eficiente
- Monitoreo de recursos específico para macOS
- Integración con el sistema de memoria unificada de Apple Silicon

## Notas

- El cliente está optimizado para Apple Silicon y no funcionará en Macs con Intel
- MLX debe estar instalado y funcionando correctamente
- Se recomienda usar la última versión de macOS para mejor rendimiento
