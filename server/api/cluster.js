const express = require('express');
const router = express.Router();

// Get cluster status
router.get('/status', (req, res) => {
    const clients = req.app.locals.clients;
    const nodes = Array.from(clients.values());
    const activeNodes = nodes.filter(node => node.status === 'connected');  // Cambiar 'active' a 'connected' para coincidir con el estado del WebSocket

    res.json({
        totalNodes: nodes.length,
        activeNodes: activeNodes.length,
        nodes: nodes.map(node => ({
            nodeId: node.nodeId,
            status: node.status,
            resources: node.resources
        }))
    });
});

// Register a node in the cluster
router.post('/node/register', (req, res) => {
    const clients = req.app.locals.clients;
    const { nodeId, capabilities, address } = req.body;

    if (!nodeId || !capabilities || !address) {
        return res.status(400).json({
            error: 'Missing required node information'
        });
    }

    clients.set(nodeId, {
        nodeId,
        capabilities,
        address,
        status: 'connected',
        lastHeartbeat: Date.now(),
        workload: 0,
        performance: {
            cpu: 0,
            memory: 0,
            gpu: capabilities.hasGPU ? 0 : null
        }
    });

    res.json({
        message: 'Node registered successfully',
        node: clients.get(nodeId)
    });
});

// Update node status
router.put('/node/:nodeId/status', (req, res) => {
    const clients = req.app.locals.clients;
    const { nodeId } = req.params;
    const node = clients.get(nodeId);

    if (!node) {
        return res.status(404).json({
            error: 'Node not found'
        });
    }

    const updates = req.body;
    Object.assign(node, updates);
    node.lastHeartbeat = Date.now();

    clients.set(nodeId, node);

    res.json({
        message: 'Node status updated',
        node: clients.get(nodeId)
    });
});

// Remove a node from the cluster
router.delete('/node/:nodeId', (req, res) => {
    const clients = req.app.locals.clients;
    const { nodeId } = req.params;

    if (!clients.has(nodeId)) {
        return res.status(404).json({
            error: 'Node not found'
        });
    }

    clients.delete(nodeId);

    res.json({
        message: 'Node removed successfully'
    });
});

// Get specific node information
router.get('/node/:nodeId', (req, res) => {
    const clients = req.app.locals.clients;
    const { nodeId } = req.params;
    const node = clients.get(nodeId);

    if (!node) {
        return res.status(404).json({
            error: 'Node not found'
        });
    }

    res.json(node);
});

// Update node workload
router.put('/node/:nodeId/workload', (req, res) => {
    const clients = req.app.locals.clients;
    const { nodeId } = req.params;
    const { workload } = req.body;

    const node = clients.get(nodeId);
    if (!node) {
        return res.status(404).json({
            error: 'Node not found'
        });
    }

    if (typeof workload !== 'number' || workload < 0 || workload > 100) {
        return res.status(400).json({
            error: 'Invalid workload value. Must be between 0 and 100'
        });
    }

    node.workload = workload;

    res.json({
        message: 'Node workload updated',
        node: node
    });
});

module.exports = router;