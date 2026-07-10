import * as vscode from 'vscode';
import { provideFffMcpServers, registerFffMcpProvider } from './fffMcpProvider';

let statusChannel: vscode.OutputChannel | undefined;

function getStatusChannel(): vscode.OutputChannel {
	statusChannel ??= vscode.window.createOutputChannel('FFF');
	return statusChannel;
}

export function activate(context: vscode.ExtensionContext): void {
	registerFffMcpProvider(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-fff.showStatus', () => {
			const channel = getStatusChannel();
			const defs = provideFffMcpServers();
			channel.clear();
			channel.appendLine('FFF MCP server definitions');
			channel.appendLine(`Generated at: ${new Date().toISOString()}`);
			channel.appendLine('');

			if (defs.length === 0) {
				const folders = vscode.workspace.workspaceFolders ?? [];
				if (folders.length === 0) {
					channel.appendLine('No workspace folder open.');
					channel.appendLine('Open a folder so fff-mcp can index the project root.');
				} else {
					channel.appendLine('No servers enabled.');
					channel.appendLine('Check `fff.enabled` for each workspace folder.');
				}
				channel.show(true);
				return;
			}

			for (const def of defs) {
				channel.appendLine(`## ${def.label}`);
				channel.appendLine(`command: ${def.command}`);
				channel.appendLine(`args:    ${JSON.stringify(def.args)}`);
				channel.appendLine(`cwd:     ${def.cwd?.fsPath ?? '(default)'}`);
				channel.appendLine(`version: ${def.version ?? '(none)'}`);
				channel.appendLine('');
			}

			channel.appendLine(`Total: ${defs.length} server(s)`);
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
	// MCP child processes are owned by VS Code; nothing to tear down here.
}
