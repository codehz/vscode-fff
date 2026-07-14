import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as vscode from 'vscode';
import type { FffLaunch } from './fffConfig';

interface JsonRpcRequest {
	jsonrpc: '2.0';
	id: number;
	method: string;
	params?: unknown;
}

interface JsonRpcNotification {
	jsonrpc: '2.0';
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc: '2.0';
	id: number | string | null;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

interface McpContentPart {
	type?: string;
	text?: string;
}

interface McpToolCallResult {
	content?: McpContentPart[];
	isError?: boolean;
}

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (err: Error) => void;
}

/**
 * Minimal MCP client over stdio (newline-delimited JSON-RPC).
 * fff-mcp speaks NDJSON, not Content-Length framing.
 */
export class FffMcpSession implements vscode.Disposable {
	private process: ChildProcessWithoutNullStreams | undefined;
	private nextId = 1;
	private readonly pending = new Map<number, PendingRequest>();
	private stdoutBuf = '';
	private startPromise: Promise<void> | undefined;
	private disposed = false;
	private alive = false;

	constructor(
		readonly launch: FffLaunch,
		private readonly log: vscode.OutputChannel,
	) {}

	get isAlive(): boolean {
		return this.alive && !this.disposed && this.process !== undefined;
	}

	get pid(): number | undefined {
		return this.process?.pid;
	}

	async ensureStarted(): Promise<void> {
		if (this.disposed) {
			throw new Error('FFF session disposed');
		}
		if (this.alive) {
			return;
		}
		if (this.startPromise) {
			return this.startPromise;
		}
		this.startPromise = this.start().finally(() => {
			this.startPromise = undefined;
		});
		return this.startPromise;
	}

	async callTool(
		name: string,
		args: Record<string, unknown>,
		token?: vscode.CancellationToken,
	): Promise<string> {
		await this.ensureStarted();
		const result = (await this.request(
			'tools/call',
			{ name, arguments: args },
			token,
		)) as McpToolCallResult;

		const texts = (result.content ?? [])
			.filter((p) => p && (p.type === 'text' || p.text !== undefined))
			.map((p) => p.text ?? '')
			.filter((t) => t.length > 0);

		const text = texts.join('\n');
		if (result.isError) {
			throw new Error(text || `FFF tool "${name}" failed`);
		}
		return text || '(no content)';
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.alive = false;
		this.rejectAll(new Error('FFF session disposed'));
		this.killProcess();
	}

	private async start(): Promise<void> {
		this.log.appendLine(
			`[${this.launch.label}] starting: ${this.launch.command} ${this.launch.args.join(' ')}`,
		);

		let child: ChildProcessWithoutNullStreams;
		try {
			child = spawn(this.launch.command, this.launch.args, {
				cwd: this.launch.cwd,
				env: this.launch.env,
				stdio: ['pipe', 'pipe', 'pipe'],
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(
				`Failed to spawn fff-mcp (${this.launch.command}): ${message}. Check fff.binaryPath.`,
			);
		}

		this.process = child;
		this.stdoutBuf = '';

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');

		child.stdout.on('data', (chunk: string) => this.onStdout(chunk));
		child.stderr.on('data', (chunk: string) => {
			for (const line of chunk.split(/\r?\n/)) {
				if (line.trim()) {
					this.log.appendLine(`[${this.launch.label}] stderr: ${line}`);
				}
			}
		});

		child.on('error', (err) => {
			this.log.appendLine(`[${this.launch.label}] process error: ${err.message}`);
			this.alive = false;
			this.rejectAll(new Error(`fff-mcp process error: ${err.message}`));
			this.process = undefined;
		});

		child.on('exit', (code, signal) => {
			this.log.appendLine(
				`[${this.launch.label}] exited code=${code ?? 'null'} signal=${signal ?? 'null'}`,
			);
			this.alive = false;
			this.rejectAll(
				new Error(
					`fff-mcp exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`,
				),
			);
			this.process = undefined;
		});

		try {
			await this.request(
				'initialize',
				{
					protocolVersion: '2024-11-05',
					capabilities: {},
					clientInfo: { name: 'vscode-fff', version: '0.1.0' },
				},
			);
			this.notify('notifications/initialized');
			this.alive = true;
			this.log.appendLine(`[${this.launch.label}] ready (pid=${child.pid ?? '?'})`);
		} catch (err) {
			this.killProcess();
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`FFF initialize failed: ${message}`);
		}
	}

	private request(
		method: string,
		params?: unknown,
		token?: vscode.CancellationToken,
	): Promise<unknown> {
		if (!this.process?.stdin.writable) {
			return Promise.reject(new Error('fff-mcp stdin not writable'));
		}

		const id = this.nextId++;
		const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

		return new Promise<unknown>((resolve, reject) => {
			let cancelSub: vscode.Disposable | undefined;

			const cleanup = () => {
				cancelSub?.dispose();
				this.pending.delete(id);
			};

			this.pending.set(id, {
				resolve: (value) => {
					cleanup();
					resolve(value);
				},
				reject: (err) => {
					cleanup();
					reject(err);
				},
			});

			if (token) {
				if (token.isCancellationRequested) {
					cleanup();
					reject(new vscode.CancellationError());
					return;
				}
				cancelSub = token.onCancellationRequested(() => {
					const pending = this.pending.get(id);
					if (pending) {
						pending.reject(new vscode.CancellationError());
					}
				});
			}

			try {
				this.write(msg);
			} catch (err) {
				cleanup();
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}

	private notify(method: string, params?: unknown): void {
		const msg: JsonRpcNotification = { jsonrpc: '2.0', method, params };
		this.write(msg);
	}

	private write(msg: JsonRpcRequest | JsonRpcNotification): void {
		const stdin = this.process?.stdin;
		if (!stdin?.writable) {
			throw new Error('fff-mcp stdin not writable');
		}
		stdin.write(`${JSON.stringify(msg)}\n`);
	}

	private onStdout(chunk: string): void {
		this.stdoutBuf += chunk;
		while (true) {
			const nl = this.stdoutBuf.indexOf('\n');
			if (nl < 0) {
				break;
			}
			const line = this.stdoutBuf.slice(0, nl).replace(/\r$/, '');
			this.stdoutBuf = this.stdoutBuf.slice(nl + 1);
			if (!line.trim()) {
				continue;
			}
			this.handleLine(line);
		}
	}

	private handleLine(line: string): void {
		let msg: JsonRpcResponse;
		try {
			msg = JSON.parse(line) as JsonRpcResponse;
		} catch {
			this.log.appendLine(`[${this.launch.label}] invalid JSON: ${line.slice(0, 200)}`);
			return;
		}

		// Notifications / server requests without matching id: ignore for now.
		if (msg.id === undefined || msg.id === null) {
			return;
		}

		const id = typeof msg.id === 'string' ? Number(msg.id) : msg.id;
		const pending = this.pending.get(id);
		if (!pending) {
			return;
		}

		if (msg.error) {
			pending.reject(
				new Error(`MCP error ${msg.error.code}: ${msg.error.message}`),
			);
			return;
		}
		pending.resolve(msg.result);
	}

	private rejectAll(err: Error): void {
		for (const [, pending] of this.pending) {
			pending.reject(err);
		}
		this.pending.clear();
	}

	private killProcess(): void {
		const child = this.process;
		this.process = undefined;
		if (!child || child.killed) {
			return;
		}
		try {
			child.stdin.end();
		} catch {
			// ignore
		}
		try {
			child.kill('SIGTERM');
		} catch {
			// ignore
		}
		// Force kill if still around shortly after.
		const pid = child.pid;
		if (pid !== undefined) {
			setTimeout(() => {
				try {
					process.kill(pid, 0);
					child.kill('SIGKILL');
				} catch {
					// already gone
				}
			}, 1500).unref?.();
		}
	}
}
