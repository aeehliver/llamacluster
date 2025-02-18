const MacClient = require('./client');
const CommandHandler = require('./command-handler');

class MacAgent {
    constructor(serverUrl) {
        this.client = new MacClient(serverUrl);
        this.commandHandler = new CommandHandler();

        // Extend client's executeCommand method to use CommandHandler
        this.client.executeCommand = (command) => {
            return this.commandHandler.executeCommand(command, (response) => {
                this.client.sendMessage({
                    type: 'commandResponse',
                    ...response
                });
            });
        };
    }

    start() {
        this.client.connect();
    }

    stop() {
        // Stop all active commands
        const activeCommands = this.commandHandler.getActiveCommands();
        activeCommands.forEach(commandId => {
            this.commandHandler.stopCommand(commandId);
        });

        // Close WebSocket connection
        if (this.client.ws) {
            this.client.ws.close();
        }
    }
}

// Start the agent when this file is run directly
if (require.main === module) {
    const agent = new MacAgent();
    agent.start();

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('Shutting down...');
        agent.stop();
        process.exit(0);
    });
}

module.exports = MacAgent;