import * as path from 'path';
import * as vscode from 'vscode';
import { getDefaultWorkspaceFolder } from './fffConfig';

/** Runtime shape of ExtendedLanguageModelToolResult (always exported by VS Code hosts). */
type ExtendedToolResult = vscode.LanguageModelToolResult & {
	toolResultDetails?: Array<vscode.Uri | vscode.Location>;
	toolResultMessage?: string | vscode.MarkdownString;
	hasError?: boolean;
};

type ExtendedToolResultCtor = new (
	content: Array<vscode.LanguageModelTextPart | vscode.LanguageModelDataPart>,
) => ExtendedToolResult;

let extensionMode: vscode.ExtensionMode | undefined;

/** Called once from activate so we can gate proposed-API fields. */
export function configureFffResultUi(mode: vscode.ExtensionMode): void {
	extensionMode = mode;
}

function getExtendedToolResultCtor(): ExtendedToolResultCtor | undefined {
	const ctor = (vscode as unknown as { ExtendedLanguageModelToolResult?: ExtendedToolResultCtor })
		.ExtendedLanguageModelToolResult;
	return typeof ctor === 'function' ? ctor : undefined;
}

/**
 * pastTenseMessage / toolResultMessage require the `chatParticipantPrivate` proposal.
 * Safe when: package declares it AND (Extension Development Host, or explicit env opt-in).
 * Marketplace installs without product.json allowlist must not set these fields.
 */
export function supportsEnhancedToolMessages(): boolean {
	if (process.env.FFF_ENABLE_PROPOSED_TOOL_UI === '1') {
		return true;
	}
	if (extensionMode !== vscode.ExtensionMode.Development) {
		return false;
	}
	try {
		const ext = vscode.extensions.getExtension('codehz.vscode-fff');
		const proposals = (ext?.packageJSON as { enabledApiProposals?: string[] } | undefined)
			?.enabledApiProposals;
		return Array.isArray(proposals) && proposals.includes('chatParticipantPrivate');
	} catch {
		return false;
	}
}

/** Strip fff path decorations: `[def]`, `git:…`, size tags. */
export function cleanRelativePath(line: string): string | undefined {
	let s = line.trim();
	if (!s || s.startsWith('→') || s.startsWith('cursor:')) {
		return undefined;
	}
	// "src/foo.ts [def]" / "src/foo.ts git:clean" / "src/foo.ts (12K)"
	s = s
		.replace(/\s+\[def\]\s*$/i, '')
		.replace(/\s+git:\S+\s*$/i, '')
		.replace(/\s+\([^)]*\)\s*$/, '')
		.trim();
	if (!s || s.includes('\0')) {
		return undefined;
	}
	// Reject match-preview style lines that leaked through
	if (/^\d+[:\-|]/.test(s)) {
		return undefined;
	}
	// Heuristic: path-like (has a separator or extension, not a sentence)
	if ((s.includes(' — ') || s.includes(' - ')) && !s.includes('/') && !s.includes('\\')) {
		return undefined;
	}
	return s;
}

/**
 * Parse fff-mcp text into URIs / Locations for Chat's expandable tool-result list.
 *
 * Grep / multi_grep (content mode):
 * ```
 * src/file.ts
 *  42: match line
 *  43| def body
 * ```
 *
 * find_files:
 * ```
 * → Read src/file.ts (best match …)
 * src/file.ts git:clean
 * ```
 */
export function parseFffResultDetails(
	text: string,
	root: vscode.Uri,
): Array<vscode.Uri | vscode.Location> {
	const locations: vscode.Location[] = [];
	const files = new Map<string, vscode.Uri>();
	let currentRel: string | undefined;

	for (const raw of text.split(/\r?\n/)) {
		if (!raw || raw === '--') {
			continue;
		}
		const trimmed = raw.trim();
		if (!trimmed || trimmed.startsWith('cursor:')) {
			continue;
		}

		if (trimmed.startsWith('→')) {
			// "→ Read src/foo.ts …"
			const m = /^→\s+Read\s+(\S+)/.exec(trimmed);
			if (m?.[1]) {
				const rel = cleanRelativePath(m[1]);
				if (rel) {
					files.set(rel, joinRoot(root, rel));
					currentRel = rel;
				}
			}
			continue;
		}

		// Match / context / def-expand line (leading whitespace + line number)
		const matchLine = /^[ \t]+(\d+)[:\-|]/.exec(raw);
		if (matchLine && currentRel) {
			const lineNo = Number(matchLine[1]);
			if (Number.isFinite(lineNo) && lineNo > 0) {
				const uri = files.get(currentRel) ?? joinRoot(root, currentRel);
				files.set(currentRel, uri);
				locations.push(new vscode.Location(uri, new vscode.Position(lineNo - 1, 0)));
			}
			continue;
		}

		// Path headers have no leading whitespace in fff content mode
		if (/^[ \t]/.test(raw)) {
			continue;
		}
		const rel = cleanRelativePath(raw);
		if (rel) {
			currentRel = rel;
			files.set(rel, joinRoot(root, rel));
		}
	}

	if (locations.length > 0) {
		return dedupeLocations(locations);
	}
	return [...files.values()];
}

function joinRoot(root: vscode.Uri, rel: string): vscode.Uri {
	// Prefer joinPath; fall back for absolute paths fff might emit
	if (path.isAbsolute(rel)) {
		return vscode.Uri.file(rel);
	}
	return vscode.Uri.joinPath(root, ...rel.split(/[/\\]+/).filter(Boolean));
}

function dedupeLocations(items: vscode.Location[]): vscode.Location[] {
	const seen = new Set<string>();
	const out: vscode.Location[] = [];
	for (const loc of items) {
		const key = `${loc.uri.toString()}#${loc.range.start.line}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		out.push(loc);
	}
	return out;
}

export function workspaceRootUri(): vscode.Uri | undefined {
	return getDefaultWorkspaceFolder()?.uri;
}

/**
 * Build a tool result that uses Chat's expandable Uri/Location list when details parse.
 * `toolResultDetails` is accepted without a proposed-API allowlist.
 * `toolResultMessage` is only set when `chatParticipantPrivate` is safely available.
 */
export function buildLanguageModelToolResult(
	text: string,
	details?: Array<vscode.Uri | vscode.Location>,
	options?: { toolResultMessage?: string | vscode.MarkdownString },
): vscode.LanguageModelToolResult {
	const content = [new vscode.LanguageModelTextPart(text)];
	const Extended = getExtendedToolResultCtor();
	const useDetails = !!details && details.length > 0;
	const useMessage =
		supportsEnhancedToolMessages() && options?.toolResultMessage !== undefined;

	if (Extended) {
		const result = new Extended(content);
		if (useDetails) {
			result.toolResultDetails = details;
		}
		if (useMessage) {
			result.toolResultMessage = options.toolResultMessage;
		}
		return result;
	}

	const result = new vscode.LanguageModelToolResult(content) as ExtendedToolResult;
	if (useDetails) {
		// Duck-type: host converter reads toolResultDetails off the result object.
		result.toolResultDetails = details;
	}
	return result;
}

/** Attach pastTenseMessage only when chatParticipantPrivate is usable. */
export function withPastTenseMessage(
	prepared: vscode.PreparedToolInvocation,
	pastTenseMessage: string | vscode.MarkdownString,
): vscode.PreparedToolInvocation {
	if (!supportsEnhancedToolMessages()) {
		return prepared;
	}
	return Object.assign({}, prepared, { pastTenseMessage });
}
