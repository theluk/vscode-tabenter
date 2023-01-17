// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { env } from "process";
import * as vscode from "vscode";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "tabenterleaderboard" is now active!'
  );

  let currentRecorder: vscode.Disposable | undefined;
  let humanCount = 0;
  let pilotCount = 0;

  let statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  context.subscriptions.push(statusBar);

  function createRecorder() {
    const extension = vscode.extensions.getExtension("github.copilot");
    const copilotIsActive = extension?.isActive;

    if (!copilotIsActive) {
      statusBar.hide();
      vscode.window.showErrorMessage(
        "This extension makes only sense when the Copilot extension is active."
      );
      return vscode.Disposable.from();
    }

    let insertSpaces = vscode.workspace
      .getConfiguration()
      .get<boolean | undefined>("editor.insertSpaces");
    let tabSize = vscode.workspace
      .getConfiguration()
      .get<number | undefined>("editor.tabSize");

    let currentPosition: vscode.Position;
    let selectionLength = 0;
    let selectionValue: string[] = [];
    const selectionListener = vscode.window.onDidChangeTextEditorSelection(
      (event) => {
        currentPosition = event.selections[0].active;
        selectionLength = 0;
        selectionValue = [];
        event.selections.forEach((selection) => {
          const text = event.textEditor.document.getText(selection);
          selectionLength += text.length;
          selectionValue.push(text);
        });
      }
    );

    let deletedValues: string[] = [];

    const textDocChangeHandler = vscode.workspace.onDidChangeTextDocument(
      async (event) => {
        if (
          vscode.window.activeTextEditor &&
          event.document === vscode.window.activeTextEditor.document
        ) {
          for (const change of event.contentChanges) {
            if (
              change.rangeLength === selectionLength &&
              selectionLength > 1 &&
              !change.text
            ) {
              deletedValues.push(selectionValue.join(""));
            }

            if (change.text.trim().length <= 1) {
              humanCount += change.text.trim().length;
              continue;
            }

            if (change.text.trim().length === change.rangeLength) {
              humanCount += change.text.trim().length;
              continue;
            }

            if (selectionLength > 0) {
              humanCount += change.text.trim().length;
              continue;
            }

            if (change.text.length > 1) {
              const inDeletedValues = deletedValues.lastIndexOf(change.text);

              if (inDeletedValues > -1) {
                deletedValues = deletedValues.slice(0, inDeletedValues);
                continue;
              }
            }

            const numberOfLeadingSpaces = change.text.match(/^ */)?.[0].length;
            const numberOfLeadingTabs = change.text.match(/^\t*/)?.[0].length;

            const isSpaceIndent =
              insertSpaces &&
              tabSize &&
              numberOfLeadingSpaces &&
              numberOfLeadingSpaces % tabSize === 0;
            const isTabIndent = !insertSpaces && numberOfLeadingTabs;

            const isIndent = isSpaceIndent || isTabIndent;

            if (isIndent) {
              const clipboardText = await vscode.env.clipboard.readText();

              if (clipboardText.trim() == change.text.trim()) {
                continue;
              }
            }

            if (change.range.start.line !== currentPosition.line) {
              continue;
            }

            console.log({
              isIndent,
              range: change.rangeLength,
              text: change.text,
            });

            pilotCount += change.text.trim().length - change.rangeLength;
          }
        }

        statusBar.text = `Human: ${humanCount} Vs. Machine: ${pilotCount}`;
        statusBar.show();
      }
    );

    return vscode.Disposable.from(selectionListener, textDocChangeHandler);
  }

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let recordingCommand = vscode.commands.registerCommand(
    "tabenterleaderboard.startRecording",
    () => {
      if (currentRecorder) {
        currentRecorder.dispose();
      }

      currentRecorder = createRecorder();
    }
  );

  let stopCommand = vscode.commands.registerCommand(
    "tabenterleaderboard.stopRecording",
    () => {
      humanCount = 0;
      pilotCount = 0;
      statusBar.hide();
      if (currentRecorder) {
        currentRecorder.dispose();
      }
    }
  );

  context.subscriptions.push(recordingCommand, stopCommand, {
    dispose: () => {
      if (currentRecorder) {
        currentRecorder.dispose();
      }
    },
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
