// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exec } from "child_process";
import * as fs from 'fs';
import { ReasonedAnalysis } from './analysis.js';
import { askAgent, launchAgentProcess } from './agent_utils.js';
import { deleteFile, getFileVulnerabilities, markdown, parseSlitherReport } from './utils.js';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	vscode.window.showInformationMessage('Extension "Vigil3" is now active!');

  launchAgentProcess(context);
  // addHardhat(context);

  // Executer npx hardhat lint sur le fichier sauvegardé
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('vigil3');

	const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
   if (document.languageId === 'solidity' || document.fileName.endsWith('.sol')) {
      runLint(document, diagnosticCollection, context);
    }
  });

  const hoverProvider = markdown();
  context.subscriptions.push(hoverProvider);
  context.subscriptions.push(onSave);
}

function runLint(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection, ctx: vscode.ExtensionContext) {
    exec(`source .venv/bin/activate && npx hardhat vigil3 ${document.fileName}`,
      { cwd: ctx.extensionUri.fsPath },
       async (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        return;
      }
      // open file json_output.json and read its content
      let file = fs.readFileSync(`${ctx.extensionUri.fsPath}/slither-${document.fileName.split('/').pop()}.json`, 'utf8');
      // If file is the same as previous, do nothing
      let previousFile = fs.readFileSync(`${ctx.extensionUri.fsPath}/previous-slither-report.json`, 'utf8');

      let json_output = getFileVulnerabilities(file);
      let previous_json_output = getFileVulnerabilities(previousFile);

      if (JSON.stringify(json_output) === JSON.stringify(previous_json_output) || !json_output.results || !json_output.results.detectors) {

        deleteFile(ctx, document);
        return;
      }


      let diagnostics: vscode.Diagnostic[] = [];
      parseSlitherReport(json_output, diagnostics);
      diagnosticCollection.set(document.uri, diagnostics);

      // appel api
      let json_string = JSON.stringify(json_output);
      let response_ia = await askAgent(document.getText(), json_string);
      console.log('Response from agent:', response_ia);

      // update diagnostics with response from ia
      if (response_ia)  {
        updateDiagnosticsWithAgentResponse(diagnosticCollection, document.uri, diagnostics, response_ia);
      }

      fs.writeFileSync(`${ctx.extensionUri.fsPath}/previous-slither-report.json`, file);
      deleteFile(ctx, document);
    });
}



export function updateDiagnosticsWithAgentResponse(
  diagnosticCollection: vscode.DiagnosticCollection,
  uri: vscode.Uri,
  diagnostics: vscode.Diagnostic[],
  agentResponse: ReasonedAnalysis
) {
  const updatedDiagnostics: vscode.Diagnostic[] = [];

  diagnostics.forEach((diagnostic, index) => {
    const agentIssue = agentResponse.analysis[index];
    if (agentIssue) {
      const updatedMessage = agentIssue.reasoning;
      const updatedDiagnostic = new vscode.Diagnostic(
        diagnostic.range,
        "VULNERABILITY",
        diagnostic.severity
      );
      (updatedDiagnostic as any).customMessage = updatedMessage;

      updatedDiagnostics.push(updatedDiagnostic);
    } else {
      updatedDiagnostics.push(diagnostic);
    }
  });

  diagnosticCollection.set(uri, updatedDiagnostics);
}

// This method is called when your extension is deactivated
export function deactivate() {}
