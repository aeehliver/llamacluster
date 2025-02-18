#!/bin/bash

# Verificar que MLX está instalado
python3 -c "import mlx.core" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Error: MLX no está instalado. Instalando..."
    pip3 install mlx
fi

# Instalar dependencias de Node.js si no están instaladas
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias de Node.js..."
    npm install
fi

# Iniciar el cliente
echo "Iniciando cliente Mac..."
node index.js
