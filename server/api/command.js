const express = require('express');
const router = express.Router();

// Store active commands in memory (in production, use a database)
const activeCommands = new Map();

// Generate a unique command ID
function generateCommandId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Submit a new command
router.post('/submit', (req, res) => {
    const { command, parameters, priority, nodeId } = req.body;

    if (!command || !nodeId) {
        return res.status(400).json({
            error: 'Missing required command information'
        });
    }

    const commandId = generateCommandId();
    const commandData = {
        commandId,
        command,
        parameters: parameters || {},
        priority: priority || 'normal',
        nodeId,
        status: 'pending',
        submittedAt: Date.now(),
        startedAt: null,
        completedAt: null,
        result: null,
        error: null
    };

    activeCommands.set(commandId, commandData);

    res.json({
        message: 'Command submitted successfully',
        commandId,
        command: commandData
    });
});

// Get command status
router.get('/:commandId/status', (req, res) => {
    const { commandId } = req.params;
    const command = activeCommands.get(commandId);

    if (!command) {
        return res.status(404).json({
            error: 'Command not found'
        });
    }

    res.json(command);
});

// Update command status
router.put('/:commandId/status', (req, res) => {
    const { commandId } = req.params;
    const { status, result, error } = req.body;

    const command = activeCommands.get(commandId);
    if (!command) {
        return res.status(404).json({
            error: 'Command not found'
        });
    }

    command.status = status;
    if (status === 'running' && !command.startedAt) {
        command.startedAt = Date.now();
    } else if (status === 'completed' || status === 'failed') {
        command.completedAt = Date.now();
        command.result = result;
        command.error = error;
    }

    res.json({
        message: 'Command status updated',
        command: command
    });
});

// Cancel a command
router.post('/:commandId/cancel', (req, res) => {
    const { commandId } = req.params;
    const command = activeCommands.get(commandId);

    if (!command) {
        return res.status(404).json({
            error: 'Command not found'
        });
    }

    if (command.status === 'completed' || command.status === 'failed') {
        return res.status(400).json({
            error: 'Cannot cancel a completed or failed command'
        });
    }

    command.status = 'cancelled';
    command.completedAt = Date.now();

    res.json({
        message: 'Command cancelled successfully',
        command: command
    });
});

// List all commands for a node
router.get('/node/:nodeId', (req, res) => {
    const { nodeId } = req.params;
    const { status } = req.query;

    const nodeCommands = Array.from(activeCommands.values())
        .filter(cmd => cmd.nodeId === nodeId)
        .filter(cmd => !status || cmd.status === status);

    res.json({
        nodeId,
        commands: nodeCommands
    });
});

module.exports = router;