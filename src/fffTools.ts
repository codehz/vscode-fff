import * as vscode from 'vscode';
import type { FffSessionManager } from './fffSessionManager';

const TOOL_GREP = 'grep';
const TOOL_FIND_FILES = 'find_files';
const TOOL_MULTI_GREP = 'multi_grep';

interface GrepInput {
	pattern: string;
	constraints?: string | null;
	maxResults?: number | null;
	cursor?: string | null;
	output_mode?: string | null;
}

interface FindFilesInput {
	query: string;
	constraints?: string | null;
	maxResults?: number | null;
	cursor?: string | null;
}

interface MultiGrepInput {
	patterns: string[];
	constraints?: string | null;
	maxResults?: number | null;
	cursor?: string | null;
	output_mode?: string | null;
	context?: number | null;
}

/** Drop null/undefined/empty values before forwarding to fff-mcp. */
function compactArgs(input: Record<string, unknown>): Record<string, unknown> {
	const args: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined || value === null || value === '') {
			continue;
		}
		args[key] = value;
	}
	return args;
}

/**
 * fff-mcp grep/find_files expect constraints inlined into `query`.
 * multi_grep has a separate `constraints` field — leave that path alone.
 */
function joinConstraintQuery(constraints: string | null | undefined, text: string): string {
	const c = constraints?.trim();
	return c ? `${c} ${text}` : text;
}

function truncate(s: string, max = 60): string {
	const oneLine = s.replace(/\s+/g, ' ').trim();
	if (oneLine.length <= max) {
		return oneLine;
	}
	return `${oneLine.slice(0, max - 1)}…`;
}

async function invokeMcp(
	manager: FffSessionManager,
	mcpName: string,
	args: Record<string, unknown>,
	token: vscode.CancellationToken,
): Promise<vscode.LanguageModelToolResult> {
	const session = await manager.getSession();
	const text = await session.callTool(mcpName, compactArgs(args), token);
	return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
}

class FffGrepTool implements vscode.LanguageModelTool<GrepInput> {
	constructor(private readonly manager: FffSessionManager) {}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<GrepInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const pattern = options.input?.pattern ?? '';
		const constraints = options.input?.constraints?.trim();
		const scope = constraints ? ` [${truncate(constraints, 24)}]` : '';
		return {
			invocationMessage: `FFF: grep "${truncate(pattern)}"${scope}`,
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<GrepInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const pattern = options.input?.pattern?.trim();
		if (!pattern) {
			throw new Error('grep requires a non-empty "pattern" string.');
		}
		return invokeMcp(
			this.manager,
			'grep',
			{
				query: joinConstraintQuery(options.input?.constraints, pattern),
				maxResults: options.input?.maxResults,
				cursor: options.input?.cursor,
				output_mode: options.input?.output_mode,
			},
			token,
		);
	}
}

class FffFindFilesTool implements vscode.LanguageModelTool<FindFilesInput> {
	constructor(private readonly manager: FffSessionManager) {}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<FindFilesInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const q = options.input?.query ?? '';
		const constraints = options.input?.constraints?.trim();
		const scope = constraints ? ` [${truncate(constraints, 24)}]` : '';
		return {
			invocationMessage: `FFF: find files "${truncate(q)}"${scope}`,
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<FindFilesInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const query = options.input?.query?.trim();
		if (!query) {
			throw new Error('find_files requires a non-empty "query" string.');
		}
		return invokeMcp(
			this.manager,
			'find_files',
			{
				query: joinConstraintQuery(options.input?.constraints, query),
				maxResults: options.input?.maxResults,
				cursor: options.input?.cursor,
			},
			token,
		);
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
		const constraints = options.input?.constraints?.trim();
		const scope = constraints ? ` [${truncate(constraints, 24)}]` : '';
		return {
			invocationMessage: `FFF: multi_grep ${preview}${scope}`,
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
		return invokeMcp(
			this.manager,
			'multi_grep',
			{
				patterns,
				constraints: options.input?.constraints,
				maxResults: options.input?.maxResults,
				cursor: options.input?.cursor,
				output_mode: options.input?.output_mode,
				context: options.input?.context,
			},
			token,
		);
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
