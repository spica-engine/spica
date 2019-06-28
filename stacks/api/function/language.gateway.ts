import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WsResponse
} from "@nestjs/websockets";
import * as path from "path";
import {Observable, of, Subject} from "rxjs";
import {bufferCount, catchError, debounceTime, filter, map, switchMap} from "rxjs/operators";
import {CommandTypes, Diagnostic} from "typescript/lib/protocol";
import {ScriptElementKind} from "typescript/lib/tsserverlibrary";
import {FunctionHost} from "./engine";
import {TspClient} from "./engine/language";

@WebSocketGateway({namespace: "functionlsp", transports: ["websocket"]})
export class LanguageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly tsp: TspClient = new TspClient({
    logVerbosity: "info",
    logFile: "/tmp/languageserver.log"
  });
  private file: string;
  private projectFileName = "spica";

  private diagnosticQueue = new Subject();

  constructor(private fh: FunctionHost) {}

  handleConnection() {
    this.tsp.start();
    this.tsp.request(CommandTypes.Configure, {
      hostInfo: "Spica"
    });
    this.diagnosticQueue
      .pipe(
        debounceTime(200),
        switchMap(() => this.tsp.request(CommandTypes.Geterr, {files: [this.file], delay: 0}))
      )
      .subscribe();
  }

  handleDisconnect() {
    this.tsp.stop();
    this.diagnosticQueue.complete();
  }

  @SubscribeMessage("open")
  open(_, id: string): Observable<WsResponse> {
    this.file = path.join(this.fh.getRoot({_id: id}), "index.ts");
    this.tsp.notify(CommandTypes.Open, {
      file: this.file,
      projectFileName: this.projectFileName,
      projectRootPath: this.fh.getRoot({_id: id})
    });
    return this.tsp.event.pipe(
      filter(
        event =>
          event.event == "suggestionDiag" ||
          event.event == "semanticDiag" ||
          event.event == "syntaxDiag"
      ),
      bufferCount(3),
      map(events => {
        const data = events
          .reduce(
            (diagnostics, event) => {
              diagnostics.push(...event.body.diagnostics);
              return diagnostics;
            },
            [] as Diagnostic[]
          )
          .map(diagnostic => {
            const diag: any = {
              startLineNumber: diagnostic.start.line,
              startColumn: diagnostic.start.offset,
              endLineNumber: diagnostic.end.line,
              endColumn: diagnostic.end.offset,
              code: String(diagnostic.code),
              message: diagnostic.text,
              severity: asMarkerSeverity(diagnostic.category),
              source: diagnostic.source
            };
            if (diagnostic.relatedInformation) {
              diag.relatedInformation = diagnostic.relatedInformation.map(rinf => {
                const relatedInfo: any = {
                  message: rinf.message
                };
                if (rinf.span) {
                  relatedInfo.startLineNumber = rinf.span.start.line;
                  relatedInfo.startColumn = rinf.span.start.offset;
                  relatedInfo.endLineNumber = rinf.span.end.line;
                  relatedInfo.endColumn = rinf.span.end.offset;
                }
                return relatedInfo;
              });
            }
            return diag;
          });
        return {event: "diagnostics", data};
      }),
      catchError(() => {
        return of({event: "diagnostics", data: []});
      })
    );
  }

  @SubscribeMessage("codeLenses")
  async codeLens(_, commandId: string) {
    const {body} = await this.tsp.request(CommandTypes.NavTree, {
      file: this.file,
      projectFileName: this.projectFileName
    });

    if (body.kind != "module") {
      return [];
    }

    // TODO(thesayyn): Load triggers from db after
    // we introduce multiple trigger support
    return body.childItems
      .filter(
        item => item.kind == "function" && item.kindModifiers == "export" && item.text == "default"
      )
      .map(item => ({
        id: `run_${item.text}`,
        command: {
          id: commandId,
          title: "Run",
          tooltip: "Run this function",
          arguments: [
            {
              handler: item.text
            }
          ]
        },
        range: {
          startLineNumber: item.spans[0].start.line,
          startColumn: item.spans[0].start.offset,
          endLineNumber: item.spans[0].end.line,
          endColumn: item.spans[0].end.offset
        }
      }));
  }

  @SubscribeMessage("documentChanges")
  async updateDocument(_, changes: any[]) {
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      this.tsp.notify(CommandTypes.Change, {
        file: this.file,
        line: change.range.startLineNumber,
        offset: change.range.startColumn,
        endLine: change.range.endLineNumber,
        endOffset: change.range.endColumn,
        insertString: change.text
      });
    }
    this.diagnosticQueue.next();
  }

  @SubscribeMessage("hover")
  async hover(_, position) {
    return this.tsp
      .request(CommandTypes.Quickinfo, {
        file: this.file,
        line: position.lineNumber,
        offset: position.column
      })
      .then(({body}) => {
        return {
          contents: [
            {
              value: "```typescript\n" + body.displayString + "\n```"
            },
            {
              value: body.documentation
            },
            {
              value: (body.tags || []).map(tag => `${tag.name} — ${tag.text}`).join("\n")
            }
          ],
          range: {
            startLineNumber: body.start.line,
            startColumn: body.start.offset,
            endLineNumber: body.end.line,
            endColumn: body.end.offset
          }
        };
      })
      .catch(() => ({contents: []}));
  }

  @SubscribeMessage("completions")
  completions(_, {lineNumber, column, triggerCharacter}) {
    return this.tsp
      .request(CommandTypes.Completions, {
        file: this.file,
        line: lineNumber,
        offset: column,
        triggerCharacter,
        includeExternalModuleExports: true,
        includeInsertTextCompletions: true
      })
      .then(({body}) =>
        body.map(item => {
          const completion: any = {
            label: item.name,
            kind: getCompletionItemKind(item.kind),
            sortText: item.sortText,
            preselect: item.isRecommended,
            insertText: item.insertText || item.name,
            commitCharacters: asCommitCharacters(item.kind)
          };

          if (item.replacementSpan) {
            completion.range = {
              startLineNumber: item.replacementSpan.start.line,
              startColumn: item.replacementSpan.start.offset,
              endLineNumber: item.replacementSpan.end.line,
              endColumn: item.replacementSpan.end.offset
            };
          }

          return completion;
        })
      )
      .catch(() => []);
  }

  @SubscribeMessage("foldingRange")
  async foldingRange(): Promise<any[]> {
    const {body} = await this.tsp.request(CommandTypes.GetOutliningSpans, {file: this.file});
    return body.map(span => {
      return {
        start: span.textSpan.start.line,
        end: span.textSpan.end.line,
        kind: span.kind
      };
    });
  }
}

function asMarkerSeverity(category: "error" | "warning" | "suggestion" | string) {
  const severityMap = {
    suggestion: 1,
    Info: 2,
    warning: 4,
    error: 8
  };
  return severityMap[category];
}

function asCommitCharacters(kind: ScriptElementKind): string[] | undefined {
  const commitCharacters: string[] = [];
  switch (kind) {
    case ScriptElementKind.memberGetAccessorElement:
    case ScriptElementKind.memberSetAccessorElement:
    case ScriptElementKind.constructSignatureElement:
    case ScriptElementKind.callSignatureElement:
    case ScriptElementKind.indexSignatureElement:
    case ScriptElementKind.enumElement:
    case ScriptElementKind.interfaceElement:
      commitCharacters.push(".");
      break;

    case ScriptElementKind.moduleElement:
    case ScriptElementKind.alias:
    case ScriptElementKind.constElement:
    case ScriptElementKind.letElement:
    case ScriptElementKind.variableElement:
    case ScriptElementKind.localVariableElement:
    case ScriptElementKind.memberVariableElement:
    case ScriptElementKind.classElement:
    case ScriptElementKind.functionElement:
    case ScriptElementKind.memberFunctionElement:
      commitCharacters.push(".", ",");
      commitCharacters.push("(");
      break;
  }

  return commitCharacters.length === 0 ? undefined : commitCharacters;
}

function getCompletionItemKind(kind: ScriptElementKind) {
  const kinds = {
    Method: 0,
    Function: 1,
    Constructor: 2,
    Field: 3,
    Variable: 4,
    Class: 5,
    Struct: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Event: 10,
    Operator: 11,
    Unit: 12,
    Value: 13,
    Constant: 14,
    Enum: 15,
    EnumMember: 16,
    Keyword: 17,
    Text: 18,
    Color: 19,
    File: 20,
    Reference: 21,
    Customcolor: 22,
    Folder: 23,
    TypeParameter: 24,
    Snippet: 25
  };
  switch (kind) {
    case ScriptElementKind.primitiveType:
    case ScriptElementKind.keyword:
      return kinds.Keyword;
    case ScriptElementKind.constElement:
      return kinds.Constant;
    case ScriptElementKind.letElement:
    case ScriptElementKind.variableElement:
    case ScriptElementKind.localVariableElement:
    case ScriptElementKind.alias:
      return kinds.Variable;
    case ScriptElementKind.memberVariableElement:
    case ScriptElementKind.memberGetAccessorElement:
    case ScriptElementKind.memberSetAccessorElement:
      return kinds.Field;
    case ScriptElementKind.functionElement:
      return kinds.Function;
    case ScriptElementKind.memberFunctionElement:
    case ScriptElementKind.constructSignatureElement:
    case ScriptElementKind.callSignatureElement:
    case ScriptElementKind.indexSignatureElement:
      return kinds.Method;
    case ScriptElementKind.enumElement:
      return kinds.Enum;
    case ScriptElementKind.moduleElement:
    case ScriptElementKind.externalModuleName:
      return kinds.Module;
    case ScriptElementKind.classElement:
    case ScriptElementKind.typeElement:
      return kinds.Class;
    case ScriptElementKind.interfaceElement:
      return kinds.Interface;
    case ScriptElementKind.warning:
    case ScriptElementKind.scriptElement:
      return kinds.File;
    case ScriptElementKind.directory:
      return kinds.Folder;
    case ScriptElementKind.string:
      return kinds.Constant;
  }
  return kinds.Property;
}
