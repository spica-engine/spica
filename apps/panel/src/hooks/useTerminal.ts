import {useState, useCallback, useRef, useMemo} from "react";
import {useGetCommandsQuery, useExecuteCommandMutation} from "../store/api/versionControlApi";
import {parseArgs} from "../utils/parseArgs";
import type {TerminalLineEntry} from "../types/version-control";

export function useTerminal() {
  const {data: commandsData} = useGetCommandsQuery();
  const [executeCommand, {isLoading}] = useExecuteCommandMutation();
  const [history, setHistory] = useState<TerminalLineEntry[]>([]);
  const lineIdRef = useRef(0);

  const nextId = useCallback(() => String(++lineIdRef.current), []);

  const validCommands = useMemo(() => {
    if (Array.isArray(commandsData)) return commandsData;
    if (commandsData) return Object.keys(commandsData);
    return [];
  }, [commandsData]);

  const appendLines = useCallback((newLines: TerminalLineEntry[]) => {
    setHistory(prev => [...prev, ...newLines]);
  }, []);

  const handleSubmit = useCallback(
    async (raw: string) => {
      const parts = parseArgs(raw);
      const stripped = parts[0] === "git" ? parts.slice(1) : parts;
      const command = stripped[0];
      const args = stripped.slice(1);

      appendLines([{id: nextId(), text: raw, variant: "command"}]);

      if (!command || !validCommands.includes(command)) {
        appendLines([{id: nextId(), text: `Unknown command: ${raw}`, variant: "error"}]);
        return;
      }

      try {
        const result = await executeCommand({command, args}).unwrap();

        let outputLines: string[];
        if (Array.isArray(result)) {
          outputLines = result;
        } else if (typeof result === "string") {
          outputLines = result.split("\n");
        } else {
          outputLines = [JSON.stringify(result)];
        }

        appendLines(
          outputLines.map(line => ({
            id: nextId(),
            text: line,
            variant: "output" as const
          }))
        );
      } catch (err: unknown) {
        const apiErr = err as {data?: {message?: string}; message?: string};
        const message = apiErr?.data?.message || apiErr?.message || "Command execution failed";
        appendLines([{id: nextId(), text: message, variant: "error"}]);
      }
    },
    [validCommands, executeCommand, appendLines, nextId]
  );

  return {history, handleSubmit, isLoading};
}
