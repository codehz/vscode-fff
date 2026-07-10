import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildServerDefinition, provideFffMcpServers } from '../fffMcpProvider';

suite('FFF MCP provider', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('provideFffMcpServers returns one def per enabled folder', () => {
		const folders = vscode.workspace.workspaceFolders ?? [];
		// In the test host there may be 0 folders; still must not throw.
		const defs = provideFffMcpServers();
		assert.ok(Array.isArray(defs));
		assert.ok(defs.length <= folders.length);
	});

	test('buildServerDefinition indexes folder path as first arg', () => {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) {
			// Skip when the test workspace has no folders.
			return;
		}
		const def = buildServerDefinition(folders[0], false);
		assert.ok(def);
		assert.strictEqual(def!.args[0], folders[0].uri.fsPath);
		assert.strictEqual(def!.cwd?.fsPath, folders[0].uri.fsPath);
		assert.ok(def!.command.length > 0);
	});
});
