import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {Subject, Observable} from "rxjs";
import * as protocol from "typescript/lib/protocol";
import {Deferred} from "./utils";
import * as glob from "fast-glob";

export interface TspClientOptions {
  logFile?: string;
  logVerbosity?: string;
  globalPlugins?: string[];
}

interface TypeScriptRequestTypes {
  geterr: [protocol.GeterrRequestArgs, any];
  documentHighlights: [protocol.DocumentHighlightsRequestArgs, protocol.DocumentHighlightsResponse];
  applyCodeActionCommand: [
    protocol.ApplyCodeActionCommandRequestArgs,
    protocol.ApplyCodeActionCommandResponse
  ];
  completionEntryDetails: [
    protocol.CompletionDetailsRequestArgs,
    protocol.CompletionDetailsResponse
  ];
  completionInfo: [protocol.CompletionsRequestArgs, protocol.CompletionInfoResponse];
  completions: [protocol.CompletionsRequestArgs, protocol.CompletionsResponse];
  configure: [protocol.ConfigureRequestArguments, protocol.ConfigureResponse];
  definition: [protocol.FileLocationRequestArgs, protocol.DefinitionResponse];
  definitionAndBoundSpan: [
    protocol.FileLocationRequestArgs,
    protocol.DefinitionInfoAndBoundSpanReponse
  ];
  docCommentTemplate: [protocol.FileLocationRequestArgs, protocol.DocCommandTemplateResponse];
  format: [protocol.FormatRequestArgs, protocol.FormatResponse];
  formatonkey: [protocol.FormatOnKeyRequestArgs, protocol.FormatResponse];
  getApplicableRefactors: [
    protocol.GetApplicableRefactorsRequestArgs,
    protocol.GetApplicableRefactorsResponse
  ];
  getCodeFixes: [protocol.CodeFixRequestArgs, protocol.GetCodeFixesResponse];
  getCombinedCodeFix: [protocol.GetCombinedCodeFixRequestArgs, protocol.GetCombinedCodeFixResponse];
  getEditsForFileRename: [
    protocol.GetEditsForFileRenameRequestArgs,
    protocol.GetEditsForFileRenameResponse
  ];
  getEditsForRefactor: [
    protocol.GetEditsForRefactorRequestArgs,
    protocol.GetEditsForRefactorResponse
  ];
  getOutliningSpans: [protocol.FileRequestArgs, protocol.OutliningSpansResponse];
  getSupportedCodeFixes: [null, protocol.GetSupportedCodeFixesResponse];
  implementation: [protocol.FileLocationRequestArgs, protocol.ImplementationResponse];
  jsxClosingTag: [protocol.JsxClosingTagRequestArgs, protocol.JsxClosingTagResponse];
  navto: [protocol.NavtoRequestArgs, protocol.NavtoResponse];
  navtree: [protocol.FileRequestArgs, protocol.NavTreeResponse];
  occurrences: [protocol.FileLocationRequestArgs, protocol.OccurrencesResponse];
  organizeImports: [protocol.OrganizeImportsRequestArgs, protocol.OrganizeImportsResponse];
  projectInfo: [protocol.ProjectInfoRequestArgs, protocol.ProjectInfoResponse];
  quickinfo: [protocol.FileLocationRequestArgs, protocol.QuickInfoResponse];
  references: [protocol.FileLocationRequestArgs, protocol.ReferencesResponse];
  rename: [protocol.RenameRequestArgs, protocol.RenameResponse];
  signatureHelp: [protocol.SignatureHelpRequestArgs, protocol.SignatureHelpResponse];
  typeDefinition: [protocol.FileLocationRequestArgs, protocol.TypeDefinitionResponse];
}

export class TspClient {
  private readlineInterface: readline.ReadLine;
  private tsserverProc: cp.ChildProcess;
  private seq = 0;

  private readonly deferreds: {
    [seq: number]: Deferred<any>;
  } = {};

  private cancellationPipeName: string | undefined;
  private _event = new Subject<protocol.Event>();
  public readonly event: Observable<protocol.Event> = this._event.asObservable();

  constructor(private options: TspClientOptions) {
    options.globalPlugins = options.globalPlugins || [];
    options.globalPlugins.push(
      ...glob
        .sync("*.js", {cwd: path.resolve(__dirname, "plugins"), absolute: true})
        .map(p => p.toString())
    );
  }

  stop() {
    try {
      fs.unlinkSync(this.options.logFile);
    } catch {}
    if (this.tsserverProc && !this.tsserverProc.killed) {
      this.tsserverProc.kill();
    }
  }

  start() {
    const {logFile, logVerbosity, globalPlugins = []} = this.options;
    const args: string[] = [];

    try {
      fs.unlinkSync(logFile);
    } catch {}

    if (logFile) {
      args.push("--logFile", logFile);
    }
    if (logVerbosity) {
      args.push("--logVerbosity", logVerbosity);
    }

    if (globalPlugins && globalPlugins.length) {
      args.push("--globalPlugins", globalPlugins.join(","));
    }

    const tsServerPath = path.resolve(
      path.resolve(require.resolve("typescript"), "../../", "bin", "tsserver")
    );
    this.tsserverProc = cp.fork(tsServerPath, args, {
      silent: true
    });
    this.readlineInterface = readline.createInterface(
      this.tsserverProc.stdout,
      this.tsserverProc.stdin,
      undefined
    );
    process.on("exit", () => {
      this.readlineInterface.close();
      this.tsserverProc.stdin.destroy();
      this.tsserverProc.kill();
    });
    this.readlineInterface.on("line", line => this.processMessage(line));
  }

  notify(command: protocol.CommandTypes.Open, args: protocol.OpenRequestArgs): unknown;
  notify(command: protocol.CommandTypes.Close, args: protocol.FileRequestArgs): unknown;
  notify(command: protocol.CommandTypes.Saveto, args: protocol.SavetoRequestArgs): unknown;
  notify(command: protocol.CommandTypes.Change, args: protocol.ChangeRequestArgs): unknown;
  notify(command: string, args: object): unknown;
  notify(command: string, args: object): void {
    this.sendMessage(command, true, args);
  }

  request<K extends keyof TypeScriptRequestTypes>(
    command: K,
    args: TypeScriptRequestTypes[K][0],
    token?: any
  ): Promise<TypeScriptRequestTypes[K][1]> {
    this.sendMessage(command, false, args);
    const seq = this.seq;
    const request = (this.deferreds[seq] = new Deferred<any>(command)).promise;
    if (token) {
      const onCancelled = token.onCancellationRequested(() => {
        onCancelled.dispose();
        if (this.cancellationPipeName) {
          const requestCancellationPipeName = this.cancellationPipeName + seq;
          fs.writeFile(requestCancellationPipeName, "", err => {
            if (!err) {
              request.then(() =>
                fs.unlink(requestCancellationPipeName, () => {
                  /* no-op */
                })
              );
            }
          });
        }
      });
    }
    return request;
  }

  protected sendMessage(command: string, notification: boolean, args?: any): void {
    this.seq = this.seq + 1;
    let request: protocol.Request = {
      command,
      seq: this.seq,
      type: "request"
    };
    if (args) {
      request.arguments = args;
    }
    const serializedRequest = JSON.stringify(request) + "\n";
    this.tsserverProc.stdin.write(serializedRequest);
  }

  protected processMessage(untrimmedMessageString: string): void {
    const messageString = untrimmedMessageString.trim();
    if (!messageString || messageString.startsWith("Content-Length:")) {
      return;
    }
    const message: protocol.Message = JSON.parse(messageString);
    if (this.isResponse(message)) {
      this.resolveResponse(message, message.request_seq, message.success);
    } else if (this.isEvent(message)) {
      if (this.isRequestCompletedEvent(message)) {
        this.resolveResponse(message, message.body.request_seq, true);
      } else {
        this._event.next(message);
      }
    }
  }

  private resolveResponse(message: protocol.Message, request_seq: number, success: boolean) {
    const deferred = this.deferreds[request_seq];
    //console.log('request completed', { request_seq, success });
    if (deferred) {
      if (success) {
        this.deferreds[request_seq].resolve(message);
      } else {
        this.deferreds[request_seq].reject(message);
      }
      delete this.deferreds[request_seq];
    }
  }

  private isEvent(message: protocol.Message): message is protocol.Event {
    return message.type === "event";
  }

  private isResponse(message: protocol.Message): message is protocol.Response {
    return message.type === "response";
  }

  private isRequestCompletedEvent(
    message: protocol.Message
  ): message is protocol.RequestCompletedEvent {
    return this.isEvent(message) && message.event === "requestCompleted";
  }
}
