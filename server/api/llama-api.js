const express = require('express');
const router = express.Router();

// Mantener un registro de las solicitudes en curso
const activeRequests = new Map();

function selectNode(clients, requestTokens) {
    console.log('Buscando nodos disponibles...');
    console.log('Total de nodos:', clients.size);
    
    // Mostrar estado de todos los nodos
    for (const [nodeId, client] of clients.entries()) {
        console.log(`Nodo ${nodeId}:`, {
            status: client.status,
            modelStatus: client.modelStatus,
            performance: client.performance
        });
    }
    
    // Filtrar nodos conectados y con el modelo cargado
    const availableNodes = Array.from(clients.values()).filter(client => {
        const isConnected = client.status === 'connected';
        const isModelLoaded = client.modelStatus?.status === 'loaded';
        console.log(`Nodo ${client.nodeId}: conectado=${isConnected}, modeloCargado=${isModelLoaded}`);
        return isConnected && isModelLoaded;
    });

    if (availableNodes.length === 0) {
        throw new Error('No hay nodos disponibles con el modelo cargado');
    }

    // Seleccionar el nodo con menor carga
    return availableNodes.reduce((best, current) => {
        const currentLoad = current.performance?.gpu || 0;
        const bestLoad = best.performance?.gpu || 0;
        return currentLoad < bestLoad ? current : best;
    });
}

// Endpoint compatible con OpenAI para chat
router.post('/v1/chat/completions', async (req, res) => {
    const { messages, model = 'llama2', temperature = 0.7, max_tokens = 1000 } = req.body;

    try {
        // Estimar tokens basado en los mensajes
        const estimatedTokens = messages.reduce((acc, msg) => acc + msg.content.length / 4, 0);

        // Obtener el cliente menos cargado
        console.log('Buscando nodo para procesar solicitud...');
        const selectedNode = selectNode(req.app.locals.clients, estimatedTokens);
        console.log(`[API] Seleccionado nodo ${selectedNode.nodeId} para la solicitud`);

        // Crear ID único para la solicitud
        const requestId = Math.random().toString(36).substring(7);
        
        // Enviar solicitud al nodo
        const request = {
            type: 'inference',
            data: {
                requestId,
                messages,
                model,
                temperature,
                max_tokens
            }
        };

        // Registrar la solicitud
        const responsePromise = new Promise((resolve, reject) => {
            activeRequests.set(requestId, { resolve, reject });

            // Timeout después de 30 segundos
            setTimeout(() => {
                if (activeRequests.has(requestId)) {
                    activeRequests.delete(requestId);
                    reject(new Error('Timeout en la solicitud'));
                }
            }, 30000);
        });

        // Enviar solicitud al nodo
        selectedNode.ws.send(JSON.stringify(request));

        // Esperar respuesta
        const response = await responsePromise;

        res.json({
            id: requestId,
            object: 'chat.completion',
            created: Date.now(),
            model: 'llama2',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: response.text
                },
                finish_reason: response.finish_reason
            }],
            usage: {
                prompt_tokens: estimatedTokens,
                completion_tokens: response.text.length / 4,
                total_tokens: estimatedTokens + (response.text.length / 4)
            }
        });

    } catch (error) {
        console.error('[API] Error:', error);
        res.status(500).json({
            error: {
                message: error.message,
                type: 'server_error'
            }
        });
    }
});

// Manejar respuestas de los nodos
function handleNodeResponse(nodeId, message) {
    console.log('[API] Recibida respuesta del nodo:', nodeId, message);
    
    // Los campos están dentro de message.data
    const { requestId, error, text, finish_reason } = message.data;
    
    if (!activeRequests.has(requestId)) {
        console.log(`[API] No se encontró la solicitud activa para ${requestId}`);
        return;
    }

    const { resolve, reject } = activeRequests.get(requestId);
    activeRequests.delete(requestId);

    if (error) {
        console.log(`[API] Error en la solicitud ${requestId}:`, error);
        reject(new Error(error));
    } else {
        console.log(`[API] Respuesta exitosa para ${requestId}:`, { text, finish_reason });
        resolve({ text, finish_reason });
    }
}

module.exports = {
    router,
    handleNodeResponse
};
