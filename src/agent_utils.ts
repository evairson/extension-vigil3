import * as vscode from "vscode";
import { spawn } from "child_process";
import { ReasonedAnalysis } from "./analysis.js";
import * as path from "path";
import * as fs from 'fs';
import { spawnSync } from "child_process";

export function launchAgentProcess(context: vscode.ExtensionContext) {
  const agentPath = vscode.Uri.joinPath(context.extensionUri, "src", "agent_vscode.py").fsPath;
  const venvPath = vscode.Uri.joinPath(context.extensionUri, ".venv").fsPath;
  const requirementsPath = vscode.Uri.joinPath(context.extensionUri, "requirements.txt").fsPath;
  const projectDir = context.extensionUri.fsPath;

  installDependencies(context, venvPath, requirementsPath, projectDir);

  const pythonPath = path.join(venvPath, "bin", "python");
  const pythonProcess = spawn(pythonPath, [agentPath], { cwd: projectDir });

  pythonProcess.stdout.on("data", (data) => console.log(`[Agent stdout]: ${data}`));
  pythonProcess.stderr.on("data", (data) => console.error(`[Agent stderr]: ${data}`));
  pythonProcess.on("close", (code) => console.log(`[Agent process exited with code ${code}]`));

  context.subscriptions.push({
    dispose: () => {
      pythonProcess.kill();
    },
  });
}

export async function askAgent(solidity : String, slither : String) {
  const response = await fetch("http://localhost:8031/send_audit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      solidity: solidity,
      slither: slither,
      user: "",
      question: ""
    })
  });
  const data = await response.json() as ReasonedAnalysis;
  return data;
}

function installDependencies(context: vscode.ExtensionContext, venvPath: string, requirementsPath: string, projectDir: string) {
  const python = "/usr/bin/python3";

  if (!fs.existsSync(venvPath)) {
    vscode.window.showInformationMessage("🛠️ Création de l’environnement virtuel Python...");
    const createVenv = spawnSync(python, ["-m", "venv", ".venv"], { cwd: projectDir });
    if (createVenv.status !== 0) {
      vscode.window.showErrorMessage("❌ Impossible de créer la venv Python.");
      console.error(createVenv.stderr.toString());
      return;
    }
    vscode.window.showInformationMessage("✅ Environnement virtuel créé !");
  }

  const pipPath = process.platform === "win32"
    ? `${venvPath}\\Scripts\\pip.exe`
    : `${venvPath}/bin/pip`;
  if (fs.existsSync(requirementsPath)) {
    vscode.window.showInformationMessage("📦 Installation des dépendances Python...");
    const install = spawnSync(pipPath, ["install", "-r", requirementsPath], { cwd: projectDir });
    if (install.status !== 0) {
      vscode.window.showErrorMessage("❌ Erreur pendant l’installation des dépendances.");
      console.error(install.stderr.toString());
      return;
    }
    vscode.window.showInformationMessage("✅ Dépendances installées !");
  } else {
    vscode.window.showWarningMessage("⚠️ Aucun fichier requirements.txt trouvé.");
  }
}