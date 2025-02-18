const { spawn } = require('child_process');
const os = require('os');

class CommandHandler {
    constructor() {
        this.activeCommands = new Map();
    }

    executeCommand(command, callback) {
        const commandId = Date.now().toString();

        try {
            // Split command into command and arguments
            const args = command.split(' ');
            const cmd = args.shift();

            // Create process
            const process = spawn(cmd, args, {
                shell: true,
                windowsHide: true
            });

            // Store command process
            this.activeCommands.set(commandId, process);

            // Handle process output
            process.stdout.on('data', (data) => {
                callback({
                    type: 'commandOutput',
                    commandId: commandId,
                    output: data.toString(),
                    status: 'running'
                });
            });

            process.stderr.on('data', (data) => {
                callback({
                    type: 'commandError',
                    commandId: commandId,
                    error: data.toString(),
                    status: 'running'
                });
            });

            process.on('close', (code) => {
                this.activeCommands.delete(commandId);
                callback({
                    type: 'commandComplete',
                    commandId: commandId,
                    exitCode: code,
                    status: 'completed'
                });
            });

            process.on('error', (error) => {
                this.activeCommands.delete(commandId);
                callback({
                    type: 'commandError',
                    commandId: commandId,
                    error: error.message,
                    status: 'error'
                });
            });

            return commandId;

        } catch (error) {
            callback({
                type: 'commandError',
                commandId: commandId,
                error: error.message,
                status: 'error'
            });
            return null;
        }
    }

    stopCommand(commandId) {
        const process = this.activeCommands.get(commandId);
        if (process) {
            process.kill();
            this.activeCommands.delete(commandId);
            return true;
        }
        return false;
    }

    getActiveCommands() {
        return Array.from(this.activeCommands.keys());
    }
}

module.exports = CommandHandler;