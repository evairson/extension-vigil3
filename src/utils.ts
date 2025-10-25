
import * as fs from 'fs';
import * as vscode from 'vscode';


export function deleteFile() {
    try {
    fs.unlinkSync('/Users/evaherson/Documents/travail-repo/hackathon/lintkey/Vigil3/slither-report.json');
    } catch (err) {
    // Ignore if file does not exist; log other errors
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Erreur suppression slither-report.json:', err);
        vscode.window.showErrorMessage(`Erreur suppression slither-report.json: ${(err as Error).message}`);
    }
    }
}

export function markdown() {
  const hoverProvider = vscode.languages.registerHoverProvider(
    { scheme: 'file', language: 'solidity' },
    {
      provideHover(document, position) {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const diagnostic = diagnostics.find(d => d.range.contains(position));
        if (!diagnostic) return null;

        const message = (diagnostic as any).customMessage || "";

        let md = new vscode.MarkdownString(undefined, true);
        md.appendMarkdown(message);

        if (message.includes("function")) {
          const codeMatch = message.match(/```solidity([\s\S]*?)```/);
          if (codeMatch) {
            md.appendCodeblock(codeMatch[1].trim(), 'solidity');
          }
        }

        md.isTrusted = true;

        if (message.includes("loading")) {
          md = new vscode.MarkdownString("$(sync~spin) AI is working, please wait...", true);
        }

        return new vscode.Hover(md, diagnostic.range);
      }
    }
  );
 return hoverProvider;
}


export function parseSlitherReport(json_output: any, diagnostics: vscode.Diagnostic[]) {
    if (!json_output.results || !json_output.results.detectors) {
        return;
    }
    json_output.results.detectors.forEach((issue: any) => {
    let impact = issue.impact;
    
    let elements = issue.elements;
    elements.forEach((element: any) => {
        let map = element.source_mapping;
        let start = new vscode.Position(map.lines[0] - 1, map.starting_column - 1);
        let end = new vscode.Position(map.lines[map.lines.length - 1] - 1, map.ending_column - 1);
        let range = new vscode.Range(start, end);
        let message = "loading...";
        let severity = impact === 'High' ? vscode.DiagnosticSeverity.Error :
                        impact === 'Medium' ? vscode.DiagnosticSeverity.Warning :
                        vscode.DiagnosticSeverity.Information;
        let diagnostic = new vscode.Diagnostic(range, "VULNERABILITY", severity);
        (diagnostic as any).customMessage = message;
        diagnostics.push(diagnostic);
    });
    });
}

export function getFileVulnerabilities(fileContent: string): any {
    let json = JSON.parse(fileContent);
    if (!json.results || !json.results.detectors) {
        return json;
    }
    for (let i = json.results.detectors.length - 1; i >= 0; i--) {
        let issue = json.results.detectors[i];
        let impact = issue.impact;
        if (impact === 'Informational' || impact === 'Optimization' || impact === 'Low') {
            json.results.detectors.splice(i, 1);
        }
    }
    return json;
}