import * as assert from 'assert';
import * as vscode from 'vscode';
import { getDefaultWorkspaceFolder, resolveAllFffLaunches, resolveFffLaunch } from '../fffConfig';
import { cleanRelativePath, parseFffResultDetails } from '../fffResultUi';

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

	test('getDefaultWorkspaceFolder returns first enabled folder', () => {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) {
			assert.strictEqual(getDefaultWorkspaceFolder(), undefined);
			return;
		}
		const def = getDefaultWorkspaceFolder();
		assert.ok(def);
		assert.strictEqual(def!.uri.toString(), folders[0].uri.toString());
	});
});


suite('FFF result UI parsing', () => {
	const root = vscode.Uri.file('/tmp/fff-root');

	test('cleanRelativePath strips decorations', () => {
		assert.strictEqual(cleanRelativePath('src/fffTools.ts [def]'), 'src/fffTools.ts');
		assert.strictEqual(cleanRelativePath('src/fffTools.ts git:clean'), 'src/fffTools.ts');
		assert.strictEqual(cleanRelativePath('→ Read src/x.ts'), undefined);
		assert.strictEqual(cleanRelativePath('cursor: abc'), undefined);
	});

	test('parseFffResultDetails extracts locations from grep content', () => {
		const text = [
			'→ Read src/fffTools.ts [def]',
			'src/fffTools.ts',
			' 189: export function registerFffTools(',
			'  190| context: vscode.ExtensionContext,',
			'src/extension.ts',
			' 18: registerFffTools(context, manager);',
			'',
		].join('\n');
		const details = parseFffResultDetails(text, root);
		assert.ok(details.length >= 2);
		const locs = details.filter((d): d is vscode.Location => d instanceof vscode.Location);
		assert.ok(locs.some((l) => l.uri.path.endsWith('/src/fffTools.ts') && l.range.start.line === 188));
		assert.ok(locs.some((l) => l.uri.path.endsWith('/src/extension.ts') && l.range.start.line === 17));
	});

	test('parseFffResultDetails extracts file uris from find_files', () => {
		const text = [
			'→ Read src/fffTools.ts (best match — Read this file directly)',
			'src/fffTools.ts git:clean',
			'src/extension.ts git:clean',
		].join('\n');
		const details = parseFffResultDetails(text, root);
		assert.ok(details.length >= 2);
		const paths = details.map((d) => (d instanceof vscode.Location ? d.uri : d).path);
		assert.ok(paths.some((p) => p.endsWith('/src/fffTools.ts')));
		assert.ok(paths.some((p) => p.endsWith('/src/extension.ts')));
	});
});
