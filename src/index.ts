import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { startHttpServer } from './http.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = createServer(config);

if (config.transport === 'http') {
    await startHttpServer(server, config);
} else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
