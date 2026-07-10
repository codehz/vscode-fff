import * as vscode from 'vscode';

export const PROVIDER_ID = 'vscode-fff.servers';
const CONFIG_SECTION = 'fff';

/**
 * Build CLI args + env for a workspace folder from settings.
 * Index root is always the folder path so fff-mcp never falls back to $HOME.
 */
export function buildServerDefinition(
	folder: vscode.WorkspaceFolder,
	multiRoot: boolean,
): vscode.McpStdioServerDefinition | undefined {
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
	const env: Record<string, string | number | null> = {};
	if (typeof maxCachedFiles === 'number' && Number.isFinite(maxCachedFiles) && maxCachedFiles > 0) {
		args.push('--max-cached-files', String(Math.floor(maxCachedFiles)));
	}

	const label = multiRoot ? `FFF (${folder.name})` : 'FFF';
	// version fingerprint so VS Code refreshes tools when config/path changes
	const version = `${command}\0${args.join('\0')}`;

	const def = new vscode.McpStdioServerDefinition(label, command, args, env, version);
	def.cwd = folder.uri;
	return def;
}

export function provideFffMcpServers(): vscode.McpStdioServerDefinition[] {
	const folders = vscode.workspace.workspaceFolders ?? [];
	const multiRoot = folders.length > 1;
	const defs: vscode.McpStdioServerDefinition[] = [];

	for (const folder of folders) {
		const def = buildServerDefinition(folder, multiRoot);
		if (def) {
			defs.push(def);
		}
	}

	return defs;
}

export function registerFffMcpProvider(context: vscode.ExtensionContext): void {
	const didChange = new vscode.EventEmitter<void>();
	context.subscriptions.push(didChange);

	const fire = () => didChange.fire();
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(fire),
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration(CONFIG_SECTION)) {
				fire();
			}
		}),
	);

	context.subscriptions.push(
		vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
			onDidChangeMcpServerDefinitions: didChange.event,
			provideMcpServerDefinitions: () => provideFffMcpServers(),
			resolveMcpServerDefinition: (server) => server,
		}),
	);
}
