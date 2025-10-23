// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exec } from "child_process";
import * as fs from 'fs';
import { ReasonedAnalysis } from './analysis';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	
	vscode.window.showInformationMessage('Extension "Vigil3" is now active!');

  // Executer npx hardhat lint sur le fichier sauvegardé
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('vigil3');
  	context.subscriptions.push(diagnosticCollection);

	const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
   
    if (document.languageId === 'solidity' || document.fileName.endsWith('.sol')) {
      runLint(document, diagnosticCollection);
    }
  });

  context.subscriptions.push(onSave);
}

function runLint(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection) {
    exec(`source .venv/bin/activate && npx hardhat lintkey ${document.fileName}`,
    { cwd: "/Users/evaherson/Documents/travail-repo/hackathon/lintkey/Vigil3" }, async (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        return;
      }
      // open file json_output.json and read its content
      let file = fs.readFileSync('/Users/evaherson/Documents/travail-repo/hackathon/lintkey/Vigil3/slither-report.json', 'utf8');
      // If file is the same as previous, do nothing
      let previousFile = fs.readFileSync('/Users/evaherson/Documents/travail-repo/hackathon/lintkey/Vigil3/previous-slither-report.json', 'utf8');
      if (file === previousFile) {
        try {
          fs.unlinkSync('/Users/evaherson/Documents/travail-repo/hackathon/lintkey/Vigil3/slither-report.json');
        } catch (err) {
          // Ignore if file does not exist; log other errors
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Erreur suppression slither-report.json:', err);
            vscode.window.showErrorMessage(`Erreur suppression slither-report.json: ${(err as Error).message}`);
          }
        }
        return;
      }

      // appel api
      let response_ia = await askAgent(document.getText(), file, "");
      console.log('Response from agent:', response_ia);

      let json_output = JSON.parse(file);
      let diagnostics: vscode.Diagnostic[] = [];
      json_output.results.detectors.forEach((issue: any) => {
        let impact = issue.impact;
        if (impact === 'Informational' || impact === 'Optimization' || impact === 'Low') {
          return; // Skip informational issues
        }
        
        let check = issue.check;
        let elements = issue.elements;
        elements.forEach((element: any) => {
          let map = element.source_mapping;
          let start = new vscode.Position(map.lines[0] - 1, map.starting_column - 1);
          let end = new vscode.Position(map.lines[map.lines.length - 1] - 1, map.ending_column - 1);
          let range = new vscode.Range(start, end);
          let message = `[${impact}] ${check}: ${element.description}\nReasoning: ${response_ia.reasoning}\nSuggestions: ${response_ia.suggestions.join(' ')}`;
          let severity = impact === 'High' ? vscode.DiagnosticSeverity.Error :
                         impact === 'Medium' ? vscode.DiagnosticSeverity.Warning :
                         vscode.DiagnosticSeverity.Information;
          let diagnostic = new vscode.Diagnostic(range, message, severity);
          diagnostics.push(diagnostic);
        });
      });
      diagnosticCollection.set(document.uri, diagnostics);
      
      fs.writeFileSync('/Users/evaherson/Documents/travail-repo/hackathon/lintkey/Vigil3/previous-slither-report.json', file);  
      // delete file 
      try {
        fs.unlinkSync('/Users/evaherson/Documents/travail-repo/hackathon/lintkey/Vigil3/slither-report.json');
      } catch (err) {
        // Ignore if file does not exist; log other errors
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error('Erreur suppression slither-report.json:', err);
          vscode.window.showErrorMessage(`Erreur suppression slither-report.json: ${(err as Error).message}`);
        }
      }

    

    });
}

// This method is called when your extension is deactivated
export function deactivate() {}


 async function askAgent(solidity : String, slither : String, user : String) {
  vscode.window.showInformationMessage('Agent function called');
  // api called
  const response = await fetch("http://localhost:8000/send_audit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      solidity: solidity,
      slither: slither,
      user: user
    })
  });
  const data = await response.json() as ReasonedAnalysis;
  vscode.window.showInformationMessage('Response received from agent');
  return data;
}