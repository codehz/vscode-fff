import * as vscode from 'vscode';

export const CONFIG_SECTION = 'fff';

export interface FffLaunch {
	/** Workspace folder this launch targets. */
	folder: vscode.WorkspaceFolder;
	/** Display label, e.g. "FFF" or "FFF (app)". */
	label: string;
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
	/** Fingerprint for config change detection. */
	version: string;
}

/**
 * Build CLI launch config for a workspace folder from settings.
 * Index root is always the folder path so fff-mcp never falls back to $HOME.
 * Returns undefined when `fff.enabled` is false for the folder.
 */
export function resolveFffLaunch(
	folder: vscode.WorkspaceFolder,
	multiRoot: boolean,
): FffLaunch | undefined {
	const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION, folder.uri);
	if (!cfg.get<boolean>('enabled', true)) {
		return undefined;
	}

	const command = cfg.get<string>('binaryPath', 'fff-mcp').trim() || 'fff-mcp';
	const extraArgs = cfg.get<string[]>('extraArgs', []) ?? [];
	const args: string[] = [folder.uri.fsPath, ...extraArgs.filter((a) => a.length > 0)];

	const frecencyDb = cfg.get<string>('frecencyDb', '')?.trim();
	if (frecencyDb) {
		args.push('--frecency-db', frecencyDb);
	}

	const historyDb = cfg.get<string>('historyDb', '')?.trim();
	if (historyDb) {
		args.push('--history-db', historyDb);
	}

	const logFile = cfg.get<string>('logFile', '')?.trim();
	if (logFile) {
		args.push('--log-file', logFile);
	}

	const logLevel = cfg.get<string>('logLevel', '')?.trim();
	if (logLevel) {
		args.push('--log-level', logLevel);
	}

	const maxCachedFiles = cfg.get<number | null>('maxCachedFiles', null);
	if (typeof maxCachedFiles === 'number' && Number.isFinite(maxCachedFiles) && maxCachedFiles > 0) {
		args.push('--max-cached-files', String(Math.floor(maxCachedFiles)));
	}

	const label = multiRoot ? `FFF (${folder.name})` : 'FFF';
	const version = `${command}\0${args.join('\0')}`;

	return {
		folder,
		label,
		command,
		args,
		cwd: folder.uri.fsPath,
		env: { ...process.env },
		version,
	};
}

/** All enabled folder launches in the current workspace. */
export function resolveAllFffLaunches(): FffLaunch[] {
	const folders = vscode.workspace.workspaceFolders ?? [];
	const multiRoot = folders.length > 1;
	const launches: FffLaunch[] = [];
	for (const folder of folders) {
		const launch = resolveFffLaunch(folder, multiRoot);
		if (launch) {
			launches.push(launch);
		}
	}
	return launches;
}

/**
 * Default index root for tool calls: first enabled workspace folder.
 * Single-root is the primary scenario; multi-root still starts sessions
 * per folder for status, but tools always target this default.
 */
export function getDefaultWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
	const folders = vscode.workspace.workspaceFolders ?? [];
	if (folders.length === 0) {
		return undefined;
	}
	const multiRoot = folders.length > 1;
	for (const folder of folders) {
		if (resolveFffLaunch(folder, multiRoot)) {
			return folder;
		}
	}
	return folders[0];
}
