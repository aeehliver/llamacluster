const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Default model parameters
const defaultParameters = {
    temperature: 0.7,
    max_length: 2048,
    top_p: 0.95,
    context_length: 4096,
    max_tokens: 512
};

// Store model configurations in memory
let currentModel = null;

// Initialize by loading available model from models directory
async function initializeModel() {
    const modelsDir = path.join(__dirname, '../models');
    try {
        const files = fs.readdirSync(modelsDir);
        if (files.length > 0) {
            const modelFile = files[0];
            const modelPath = path.join(modelsDir, modelFile);
            const stats = fs.statSync(modelPath);
            const fileSizeInBytes = stats.size;
            const fileSizeInGB = (fileSizeInBytes / (1024 * 1024 * 1024)).toFixed(2);

            // Set model to loading state first
            currentModel = {
                name: 'TinyLlama 1.1B Chat',
                file: modelFile,
                path: modelPath,
                size: `${fileSizeInGB} GB`,
                parameters: { ...defaultParameters },
                status: 'loading'
            };

            // Broadcast model status to all connected clients
            broadcastModelStatus();

            // Simulate actual model loading (replace with real loading logic)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Update model status to loaded
            currentModel.status = 'loaded';
            broadcastModelStatus();

            console.log('Model loaded successfully:', currentModel.name);
        } else {
            console.error('No model files found in models directory');
            currentModel = {
                status: 'error',
                error: 'No model files found'
            };
        }
    } catch (error) {
        console.error('Error initializing model:', error);
        currentModel = {
            status: 'error',
            error: error.message
        };
    }
    broadcastModelStatus();
}

// Broadcast model status to all connected WebSocket clients
function broadcastModelStatus() {
    if (global.wss) {
        global.wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(JSON.stringify({
                    type: 'modelStatus',
                    data: currentModel
                }));
            }
        });
    }
}

// Initialize model on startup
initializeModel();

// Get current model configuration
router.get('/current', (req, res) => {
    res.json(currentModel);
});

// Update model configuration
router.put('/configure', (req, res) => {
    const { parameters } = req.body;

    if (!parameters) {
        return res.status(400).json({
            error: 'Missing model parameters'
        });
    }

    // Validate parameters
    if (parameters.temperature && (parameters.temperature < 0 || parameters.temperature > 1)) {
        return res.status(400).json({
            error: 'Temperature must be between 0 and 1'
        });
    }

    // Update model configuration
    currentModel.parameters = {
        ...currentModel.parameters,
        ...parameters
    };

    // Broadcast updated model status
    broadcastModelStatus();

    res.json({
        message: 'Model configuration updated successfully',
        model: currentModel
    });
});

// Reload current model
router.post('/reload', async (req, res) => {
    try {
        currentModel.status = 'loading';
        broadcastModelStatus();

        await initializeModel();

        res.json({
            message: 'Model reloaded successfully',
            model: currentModel
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to reload model',
            details: error.message
        });
    }
});

module.exports = router;