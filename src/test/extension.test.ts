import * as assert from 'assert';
import * as vscode from 'vscode';
import { resolveAllFffLaunches, resolveFffLaunch, resolveWorkspaceFolder } from '../fffConfig';

suite('FFF config', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('resolveAllFffLaunches returns at most one launch per folder', () => {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const launches = resolveAllFffLaunches();
		assert.ok(Array.isArray(launches));
		assert.ok(launches.length <= folders.length);
	});

	test('resolveFffLaunch indexes folder path as first arg', () => {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) {
			return;
		}
		const launch = resolveFffLaunch(folders[0], false);
		if (!launch) {
			// Folder disabled in test settings — still a valid outcome.
			return;
		}
		assert.strictEqual(launch.args[0], folders[0].uri.fsPath);
		assert.strictEqual(launch.cwd, folders[0].uri.fsPath);
		assert.ok(launch.command.length > 0);
		assert.ok(launch.version.includes(launch.command));
	});

	test('resolveWorkspaceFolder defaults and matches by name', () => {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) {
			return;
		}
		const def = resolveWorkspaceFolder();
		assert.ok(def);
		assert.strictEqual(def!.folder.uri.toString(), folders[0].uri.toString());
		assert.strictEqual(def!.warning, undefined);

		const byName = resolveWorkspaceFolder(folders[0].name);
		assert.ok(byName);
		assert.strictEqual(byName!.folder.uri.toString(), folders[0].uri.toString());
		assert.strictEqual(byName!.warning, undefined);

		const byPath = resolveWorkspaceFolder(folders[0].uri.fsPath);
		assert.ok(byPath);
		assert.strictEqual(byPath!.folder.uri.toString(), folders[0].uri.toString());
		assert.strictEqual(byPath!.warning, undefined);
	});

	test('resolveWorkspaceFolder falls back on unknown hint', () => {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) {
			return;
		}
		const resolved = resolveWorkspaceFolder('__no_such_workspace_folder__');
		assert.ok(resolved);
		assert.strictEqual(resolved!.folder.uri.toString(), folders[0].uri.toString());
		assert.ok(resolved!.warning?.includes('__no_such_workspace_folder__'));
		if (folders.length === 1) {
			assert.ok(resolved!.warning?.toLowerCase().includes('omit'));
			assert.ok(!resolved!.warning?.includes(`using "${folders[0].name}"`));
		} else {
			assert.ok(resolved!.warning?.includes(folders[0].name));
		}
	});
});
