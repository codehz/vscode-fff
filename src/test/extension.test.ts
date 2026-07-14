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
		assert.strictEqual(def!.uri.toString(), folders[0].uri.toString());

		const byName = resolveWorkspaceFolder(folders[0].name);
		assert.ok(byName);
		assert.strictEqual(byName!.uri.toString(), folders[0].uri.toString());

		const byPath = resolveWorkspaceFolder(folders[0].uri.fsPath);
		assert.ok(byPath);
		assert.strictEqual(byPath!.uri.toString(), folders[0].uri.toString());
	});
});
