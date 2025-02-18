const express = require('express');
const router = express.Router();

// Store model partition information
const modelPartitions = new Map();

// Calculate optimal model partitioning based on available GPU memory
function calculateModelPartitions(model, nodes) {
    const partitions = [];
    const gpuNodes = nodes.filter(node => node.capabilities.hasGPU);
    
    if (gpuNodes.length === 0) {
        throw new Error('No GPU nodes available for model distribution');
    }

    // Calculate total available GPU memory
    const totalGPUMemory = gpuNodes.reduce((sum, node) => {
        return sum + node.capabilities.gpuMemory;
    }, 0);

    // Calculate partition sizes based on available memory
    gpuNodes.forEach(node => {
        const partitionSize = (node.capabilities.gpuMemory / totalGPUMemory) * model.size;
        partitions.push({
            nodeId: node.nodeId,
            size: partitionSize,
            memoryAllocation: node.capabilities.gpuMemory
        });
    });

    return partitions;
}

// Distribute model weights across nodes
router.post('/distribute', async (req, res) => {
    const { modelId, nodes } = req.body;

    if (!modelId || !nodes || nodes.length === 0) {
        return res.status(400).json({
            error: 'Missing model ID or nodes information'
        });
    }

    try {
        const partitions = calculateModelPartitions(modelId, nodes);
        modelPartitions.set(modelId, partitions);

        // Notify each node about their partition
        const distributionPromises = partitions.map(partition => {
            return notifyNodePartition(partition.nodeId, {
                modelId,
                partition: partition
            });
        });

        await Promise.all(distributionPromises);

        res.json({
            message: 'Model distributed successfully',
            partitions: partitions
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to distribute model',
            details: error.message
        });
    }
});

// Get current model distribution
router.get('/distribution/:modelId', (req, res) => {
    const { modelId } = req.params;
    const distribution = modelPartitions.get(modelId);

    if (!distribution) {
        return res.status(404).json({
            error: 'Model distribution not found'
        });
    }

    res.json(distribution);
});

// Helper function to notify nodes about their partition
async function notifyNodePartition(nodeId, partitionInfo) {
    // Implement node notification logic here
    // This could be done via WebSocket or HTTP request to the node
    return Promise.resolve();
}

module.exports = router;