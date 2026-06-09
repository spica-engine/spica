import ora from "ora";
import {bold, yellow} from "colorette";
import {spin} from "../../console";
import {SyncReporter} from "@spica-server/sync";

/**
 * Terminal-backed {@link SyncReporter} for the CLI sync commands. Wraps the
 * engine's labeled operations in `spin()` and renders apply/fetch progress with
 * an `ora` spinner. Errors thrown by the engine still propagate to the command's
 * try/catch — the progress spinner is updated/finished, not in control of flow.
 */
export const cliReporter: SyncReporter = {
  task: (label, op) => spin({text: label, op}),

  progress: (label, total) => {
    const spinner = ora({text: `${label} (0/${total})`, color: "yellow"}).start();
    return {
      update: (slug, done, t) => {
        spinner.text = `${label}: ${slug} (${done}/${t})`;
      },
      succeed: () => spinner.succeed(),
      fail: () => spinner.fail()
    };
  },

  warn: message => console.warn(bold(yellow(`  ⚠  ${message}`)))
};
