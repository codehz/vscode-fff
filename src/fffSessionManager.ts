import * as vscode from 'vscode';
import {
	CONFIG_SECTION,
	resolveFffLaunch,
	resolveWorkspaceFolder,
	type FffLaunch,
} from './fffConfig';
import { FffMcpSession } from './fffMcpSession';

interface ManagedSession {
	session: FffMcpSession;
	version: string;
}

export class FffSessionManager implements vscode.Disposable {
	private readonly sessions = new Map<string, ManagedSession>();
	private readonly disposables: vscode.Disposable[] = [];

	constructor(private readonly log: vscode.OutputChannel) {
		this.disposables.push(
			vscode.workspace.onDidChangeWorkspaceFolders(() => this.pruneMissingFolders()),
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration(CONFIG_SECTION)) {
					this.invalidateAll('configuration changed');
				}
			}),
		);
	}

	/**
	 * Get or create a live session for the given folder hint.
	 * @param workspaceFolder optional folder name or path (tool input)
	 */
	async getSession(workspaceFolder?: string): Promise<FffMcpSession> {
		const folder = resolveWorkspaceFolder(workspaceFolder);
		if (!folder) {
			throw new Error(
				'No workspace folder open. Open a folder so FFF can index the project root.',
			);
		}

		const multiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
		const launch = resolveFffLaunch(folder, multiRoot);
		if (!launch) {
			throw new Error(
				`FFF is disabled for workspace folder "${folder.name}" (fff.enabled=false).`,
			);
		}

		const key = folder.uri.toString();
		const existing = this.sessions.get(key);
		if (existing) {
			if (existing.version === launch.version && existing.session.isAlive) {
				return existing.session;
			}
			this.log.appendLine(
				`[${launch.label}] recreating session (config or process changed)`,
			);
			existing.session.dispose();
			this.sessions.delete(key);
		}

		const session = new FffMcpSession(launch, this.log);
		this.sessions.set(key, { session, version: launch.version });
		try {
			await session.ensureStarted();
		} catch (err) {
			session.dispose();
			this.sessions.delete(key);
			throw err;
		}
		return session;
	}

	/** Snapshot of managed sessions for status output. */
	listStatus(): Array<{
		label: string;
		folder: string;
		alive: boolean;
		pid?: number;
		command: string;
		args: string[];
		version: string;
	}> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const multiRoot = folders.length > 1;
		const rows: Array<{
			label: string;
			folder: string;
			alive: boolean;
			pid?: number;
			command: string;
			args: string[];
			version: string;
		}> = [];

		for (const folder of folders) {
			const launch = resolveFffLaunch(folder, multiRoot);
			if (!launch) {
				rows.push({
					label: multiRoot ? `FFF (${folder.name})` : 'FFF',
					folder: folder.uri.fsPath,
					alive: false,
					command: '(disabled)',
					args: [],
					version: '',
				});
				continue;
			}
			const managed = this.sessions.get(folder.uri.toString());
			rows.push({
				label: launch.label,
				folder: folder.uri.fsPath,
				alive: managed?.session.isAlive ?? false,
				pid: managed?.session.pid,
				command: launch.command,
				args: launch.args,
				version: launch.version,
			});
		}
		return rows;
	}

	/** Exposed for tests / status: resolve launch without starting. */
	resolveLaunch(folder: vscode.WorkspaceFolder): FffLaunch | undefined {
		const multiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
		return resolveFffLaunch(folder, multiRoot);
	}

	dispose(): void {
		this.invalidateAll('extension dispose');
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables.length = 0;
	}

	private invalidateAll(reason: string): void {
		this.log.appendLine(`Invalidating all FFF sessions (${reason})`);
		for (const [, managed] of this.sessions) {
			managed.session.dispose();
		}
		this.sessions.clear();
	}

	private pruneMissingFolders(): void {
		const open = new Set(
			(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.toString()),
		);
		for (const [key, managed] of this.sessions) {
			if (!open.has(key)) {
				this.log.appendLine(`Disposing FFF session for removed folder ${key}`);
				managed.session.dispose();
				this.sessions.delete(key);
			}
		}
	}
}
