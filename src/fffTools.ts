import * as vscode from 'vscode';
import type { FffSessionManager } from './fffSessionManager';

const TOOL_GREP = 'grep';
const TOOL_FIND_FILES = 'find_files';
const TOOL_MULTI_GREP = 'multi_grep';

interface WorkspaceFolderInput {
	workspaceFolder?: string;
}

interface GrepInput extends WorkspaceFolderInput {
	query: string;
	maxResults?: number | null;
	cursor?: string | null;
	output_mode?: string | null;
}

interface FindFilesInput extends WorkspaceFolderInput {
	query: string;
	maxResults?: number | null;
	cursor?: string | null;
}

interface MultiGrepInput extends WorkspaceFolderInput {
	patterns: string[];
	constraints?: string | null;
	maxResults?: number | null;
	cursor?: string | null;
	output_mode?: string | null;
	context?: number | null;
}

function stripWorkspaceFolder<T extends WorkspaceFolderInput>(
	input: T,
): { folder?: string; args: Record<string, unknown> } {
	const { workspaceFolder, ...rest } = input;
	const args: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(rest)) {
		if (value === undefined || value === null || value === '') {
			continue;
		}
		args[key] = value;
	}
	return { folder: workspaceFolder, args };
}

function truncate(s: string, max = 60): string {
	const oneLine = s.replace(/\s+/g, ' ').trim();
	if (oneLine.length <= max) {
		return oneLine;
	}
	return `${oneLine.slice(0, max - 1)}…`;
}

function folderSuffix(folder?: string): string {
	const t = folder?.trim();
	return t ? ` (${t})` : '';
}

async function invokeMcp(
	manager: FffSessionManager,
	mcpName: string,
	input: WorkspaceFolderInput,
	token: vscode.CancellationToken,
): Promise<vscode.LanguageModelToolResult> {
	const { folder, args } = stripWorkspaceFolder(input);
	const session = await manager.getSession(folder);
	const text = await session.callTool(mcpName, args, token);
	return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
}

class FffGrepTool implements vscode.LanguageModelTool<GrepInput> {
	constructor(private readonly manager: FffSessionManager) {}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<GrepInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const q = options.input?.query ?? '';
		return {
			invocationMessage: `FFF${folderSuffix(options.input?.workspaceFolder)}: grep "${truncate(q)}"`,
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<GrepInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		if (!options.input?.query?.trim()) {
			throw new Error('grep requires a non-empty "query" string.');
		}
		return invokeMcp(this.manager, 'grep', options.input, token);
	}
}

class FffFindFilesTool implements vscode.LanguageModelTool<FindFilesInput> {
	constructor(private readonly manager: FffSessionManager) {}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<FindFilesInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const q = options.input?.query ?? '';
		return {
			invocationMessage: `FFF${folderSuffix(options.input?.workspaceFolder)}: find files "${truncate(q)}"`,
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<FindFilesInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		if (!options.input?.query?.trim()) {
			throw new Error('find_files requires a non-empty "query" string.');
		}
		return invokeMcp(this.manager, 'find_files', options.input, token);
	}
}

class FffMultiGrepTool implements vscode.LanguageModelTool<MultiGrepInput> {
	constructor(private readonly manager: FffSessionManager) {}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<MultiGrepInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const patterns = options.input?.patterns ?? [];
		const n = Array.isArray(patterns) ? patterns.length : 0;
		const preview =
			n === 1
				? `"${truncate(String(patterns[0]))}"`
				: `${n} patterns`;
		return {
			invocationMessage: `FFF${folderSuffix(options.input?.workspaceFolder)}: multi_grep ${preview}`,
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<MultiGrepInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const patterns = options.input?.patterns;
		if (!Array.isArray(patterns) || patterns.length === 0) {
			throw new Error('multi_grep requires a non-empty "patterns" array.');
		}
		return invokeMcp(this.manager, 'multi_grep', options.input, token);
	}
}

export function registerFffTools(
	context: vscode.ExtensionContext,
	manager: FffSessionManager,
): void {
	context.subscriptions.push(
		vscode.lm.registerTool(TOOL_GREP, new FffGrepTool(manager)),
		vscode.lm.registerTool(TOOL_FIND_FILES, new FffFindFilesTool(manager)),
		vscode.lm.registerTool(TOOL_MULTI_GREP, new FffMultiGrepTool(manager)),
	);
}

export const FFF_TOOL_NAMES = [TOOL_GREP, TOOL_FIND_FILES, TOOL_MULTI_GREP] as const;
