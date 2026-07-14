import * as vscode from 'vscode';
import { resolveAllFffLaunches } from './fffConfig';
import { FffSessionManager } from './fffSessionManager';
import { registerFffTools } from './fffTools';

let statusChannel: vscode.OutputChannel | undefined;

function getStatusChannel(): vscode.OutputChannel {
	statusChannel ??= vscode.window.createOutputChannel('FFF');
	return statusChannel;
}

export function activate(context: vscode.ExtensionContext): void {
	const log = getStatusChannel();
	const manager = new FffSessionManager(log);
	context.subscriptions.push(manager);

	registerFffTools(context, manager);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-fff.showStatus', () => {
			const channel = getStatusChannel();
			channel.clear();
			channel.appendLine('FFF language model tools');
			channel.appendLine(`Generated at: ${new Date().toISOString()}`);
			channel.appendLine('');

			const folders = vscode.workspace.workspaceFolders ?? [];
			if (folders.length === 0) {
				channel.appendLine('No workspace folder open.');
				channel.appendLine('Open a folder so fff-mcp can index the project root.');
				channel.show(true);
				return;
			}

			const launches = resolveAllFffLaunches();
			if (launches.length === 0) {
				channel.appendLine('No folders enabled.');
				channel.appendLine('Check `fff.enabled` for each workspace folder.');
				channel.show(true);
				return;
			}

			const statuses = manager.listStatus();
			for (const row of statuses) {
				channel.appendLine(`## ${row.label}`);
				channel.appendLine(`folder:  ${row.folder}`);
				channel.appendLine(`command: ${row.command}`);
				channel.appendLine(`args:    ${JSON.stringify(row.args)}`);
				channel.appendLine(
					`session: ${row.alive ? `alive (pid=${row.pid ?? '?'})` : 'not started'}`,
				);
				channel.appendLine('');
			}

			channel.appendLine('Tools: grep, find_files, multi_grep');
			channel.appendLine('(#grep, #find_files, #multi_grep)');
			channel.appendLine(`Enabled folders: ${launches.length}/${folders.length}`);
			channel.show(true);
		}),
	);

	context.subscriptions.push({
		dispose: () => {
			statusChannel?.dispose();
			statusChannel = undefined;
		},
	});
}

export function deactivate(): void {
	// Session manager is disposed via context.subscriptions.
}
