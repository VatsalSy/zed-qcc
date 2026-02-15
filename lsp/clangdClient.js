"use strict";
/**
 * clangd LSP Client
 *
 * Manages a clangd subprocess for C/C++ language features, forwarding
 * LSP requests and handling diagnostics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClangdClient = void 0;
const child_process_1 = require("child_process");
class ClangdClient {
    config;
    logger;
    process = null;
    buffer = Buffer.alloc(0);
    nextId = 1;
    pending = new Map();
    ready = false;
    readyPromise = null;
    queuedNotifications = [];
    onDiagnosticsCallback = null;
    onLogCallback = null;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    onDiagnostics(callback) {
        this.onDiagnosticsCallback = callback;
    }
    onLog(callback) {
        this.onLogCallback = callback;
    }
    isReady() {
        return this.ready;
    }
    async start(initParams) {
        if (this.process) {
            return null;
        }
        try {
            this.process = (0, child_process_1.spawn)(this.config.path, this.config.args, {
                stdio: 'pipe'
            });
        }
        catch (error) {
            this.logger.error(`Failed to start clangd: ${error.message}`);
            return null;
        }
        this.process.stdout.on('data', (chunk) => this.handleData(chunk));
        this.process.stderr.on('data', (chunk) => {
            const message = chunk.toString();
            if (this.onLogCallback) {
                this.onLogCallback(message);
            }
        });
        this.process.on('exit', (code, signal) => {
            this.ready = false;
            this.process = null;
            for (const pending of this.pending.values()) {
                pending.reject(new Error('clangd exited'));
            }
            this.pending.clear();
            const reason = signal ? `signal ${signal}` : `code ${code}`;
            this.logger.warn(`clangd exited (${reason})`);
        });
        this.readyPromise = this.initialize(initParams);
        await this.readyPromise;
        return null;
    }
    async stop() {
        if (!this.process) {
            return;
        }
        try {
            await this.request('shutdown', undefined);
        }
        catch {
            // Ignore shutdown errors.
        }
        this.notify('exit', undefined);
        this.process.kill();
        this.process = null;
        this.ready = false;
        this.pending.clear();
        this.queuedNotifications = [];
    }
    async request(method, params) {
        return this.requestInternal(method, params, false);
    }
    async requestInternal(method, params, skipReady) {
        if (!this.process) {
            throw new Error('clangd is not running');
        }
        if (!skipReady) {
            if (!this.readyPromise) {
                throw new Error('clangd has not initialized');
            }
            await this.readyPromise;
        }
        const id = this.nextId++;
        const message = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };
        const promise = new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject, method });
        });
        this.send(message);
        return promise;
    }
    notify(method, params) {
        const message = {
            jsonrpc: '2.0',
            method,
            params
        };
        if (!this.ready) {
            this.queuedNotifications.push(message);
            return;
        }
        this.send(message);
    }
    async initialize(initParams) {
        const initializationOptions = {
            fallbackFlags: this.config.fallbackFlags
        };
        const params = {
            processId: process.pid,
            rootUri: this.config.rootUri,
            workspaceFolders: this.config.workspaceFolders || undefined,
            capabilities: initParams.capabilities,
            initializationOptions
        };
        const result = await this.requestInternal('initialize', params, true).catch((error) => {
            this.logger.error(`clangd initialize failed: ${error.message}`);
            throw error;
        });
        this.ready = true;
        this.notify('initialized', {});
        this.flushNotifications();
        const initResult = result;
        if (initResult && initResult.serverInfo?.name) {
            this.logger.info(`clangd initialized (${initResult.serverInfo.name})`);
        }
    }
    flushNotifications() {
        if (!this.ready || !this.process) {
            return;
        }
        const queued = [...this.queuedNotifications];
        this.queuedNotifications = [];
        for (const notification of queued) {
            this.send(notification);
        }
    }
    handleData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) {
            const headerEnd = this.buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) {
                return;
            }
            const header = this.buffer.slice(0, headerEnd).toString('ascii');
            const lengthMatch = /Content-Length:\s*(\d+)/i.exec(header);
            if (!lengthMatch) {
                this.buffer = this.buffer.slice(headerEnd + 4);
                continue;
            }
            const messageLength = Number.parseInt(lengthMatch[1], 10);
            const totalLength = headerEnd + 4 + messageLength;
            if (this.buffer.length < totalLength) {
                return;
            }
            const body = this.buffer.slice(headerEnd + 4, totalLength).toString('utf8');
            this.buffer = this.buffer.slice(totalLength);
            try {
                const message = JSON.parse(body);
                this.handleMessage(message);
            }
            catch (error) {
                this.logger.error(`Failed to parse clangd message: ${error.message}`);
            }
        }
    }
    handleMessage(message) {
        if ('method' in message) {
            if ('id' in message) {
                void this.handleServerRequest(message);
                return;
            }
            this.handleNotification(message);
            return;
        }
        const response = message;
        const pending = this.pending.get(response.id);
        if (!pending) {
            return;
        }
        this.pending.delete(response.id);
        if (response.error) {
            pending.reject(new Error(response.error.message));
        }
        else {
            pending.resolve(response.result);
        }
    }
    handleNotification(notification) {
        switch (notification.method) {
            case 'textDocument/publishDiagnostics': {
                const params = notification.params;
                if (params && this.onDiagnosticsCallback) {
                    this.onDiagnosticsCallback(params.uri, params.diagnostics || []);
                }
                break;
            }
            case 'window/logMessage':
            case 'window/showMessage': {
                const params = notification.params;
                if (params?.message) {
                    this.logger.info(params.message);
                }
                break;
            }
            case '$/progress':
            case 'telemetry/event':
                break;
            default:
                break;
        }
    }
    async handleServerRequest(request) {
        let result = null;
        switch (request.method) {
            case 'workspace/configuration': {
                const params = request.params;
                const items = params?.items ?? [];
                result = items.map(() => ({}));
                break;
            }
            case 'client/registerCapability':
            case 'client/unregisterCapability':
            case 'window/workDoneProgress/create':
                result = null;
                break;
            case 'workspace/applyEdit':
                result = { applied: false };
                break;
            default:
                result = null;
                break;
        }
        this.send({
            jsonrpc: '2.0',
            id: request.id,
            result
        });
    }
    send(message) {
        if (!this.process) {
            return;
        }
        const payload = JSON.stringify(message);
        const header = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n`;
        this.process.stdin.write(header + payload, 'utf8');
    }
}
exports.ClangdClient = ClangdClient;
//# sourceMappingURL=clangdClient.js.map