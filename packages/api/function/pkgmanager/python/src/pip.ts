import child_process from "child_process";
import fs from "fs";
import path from "path";
import {Observable} from "rxjs";
import {Package, PackageManager} from "@spica-server/interface-function-pkgmanager";

const REQUIREMENTS_FILE = "requirements.txt";
const TARGET_DIR = ".python_packages";

/**
 * pip-backed package manager for Python functions.
 *
 * Dependencies are installed into a per-function ``.python_packages/`` directory
 * via ``pip install --target``, mirroring how ``node_modules`` work for Node
 * functions. The bootstrap puts this directory on ``sys.path``.
 */
export class Pip extends PackageManager {
  private readonly executable = process.env.FUNCTION_PYTHON_EXECUTABLE || "python3";

  install(cwd: string, _qualifiedNames: string | string[]): Observable<number> {
    const qualifiedNames = this.normalizePackageNames(_qualifiedNames);

    return new Observable(observer => {
      this.mergeRequirements(cwd, qualifiedNames).then(
        () => {
          const targetDir = path.join(cwd, TARGET_DIR);
          fs.mkdirSync(targetDir, {recursive: true});

          const args = [
            "-m",
            "pip",
            "install",
            "--target",
            targetDir,
            "--upgrade",
            "--no-input",
            "--disable-pip-version-check",
            "-r",
            REQUIREMENTS_FILE
          ];

          const proc = child_process.spawn(this.executable, args, {cwd});
          let stderr = "";
          let progress = 1;

          proc.stdout.on("data", chunk => {
            const text = chunk.toString();
            // ``pip`` prints ``Collecting``/``Downloading``/``Installing``
            // lines as it works through the resolver; bump progress for any of
            // them. Cap at 100 so callers see steady forward motion even when
            // the resolver pauses on slow indexes.
            const matches = text.match(/Collecting |Downloading |Installing /g);
            if (matches) {
              progress += matches.length;
            }
            observer.next(Math.min(progress * 5, 100));
          });
          proc.stderr.on("data", chunk => (stderr += chunk.toString()));

          proc.on("close", code => {
            if (code === 0) {
              return observer.complete();
            }
            observer.error(`pip install has failed. code: ${code}\n${stderr}`);
          });
          proc.on("error", err => observer.error(`pip install has failed. error: ${err.message}`));

          return () => {
            if (!proc.killed) {
              proc.kill("SIGKILL");
            }
          };
        },
        err => observer.error(err)
      );
    });
  }

  async uninstall(cwd: string, name: string): Promise<void> {
    const requirementsPath = path.join(cwd, REQUIREMENTS_FILE);
    if (fs.existsSync(requirementsPath)) {
      const content = await fs.promises.readFile(requirementsPath, "utf8");
      const filtered = content
        .split("\n")
        .filter(line => this.parseSpec(line)?.name !== name)
        .join("\n");
      await fs.promises.writeFile(requirementsPath, filtered);
    }

    return new Promise((resolve, reject) => {
      const proc = child_process.spawn(
        this.executable,
        [
          "-m",
          "pip",
          "uninstall",
          "--yes",
          "--no-input",
          "--disable-pip-version-check",
          "--target",
          path.join(cwd, TARGET_DIR),
          name
        ],
        {cwd}
      );
      let stderr = "";
      proc.stderr.on("data", chunk => (stderr += chunk.toString()));
      proc.on("close", code => {
        // ``pip uninstall --target`` is supported but emits a warning on some
        // versions; fall back to deleting the package directory directly so
        // we leave a clean state regardless of pip behaviour.
        const pkgDir = path.join(cwd, TARGET_DIR, name);
        try {
          fs.rmSync(pkgDir, {recursive: true, force: true});
        } catch {
          // best-effort
        }
        if (code === 0) {
          return resolve();
        }
        reject(`pip uninstall has failed. code: ${code}\n${stderr}`);
      });
      proc.on("error", err => reject(`pip uninstall has failed. error: ${err.message}`));
    });
  }

  async ls(cwd: string): Promise<Package[]> {
    const requirementsPath = path.join(cwd, REQUIREMENTS_FILE);
    if (!fs.existsSync(requirementsPath)) {
      return [];
    }
    const content = await fs.promises.readFile(requirementsPath, "utf8");
    return content
      .split("\n")
      .map(line => this.parseSpec(line))
      .filter((p): p is Package => Boolean(p));
  }

  private async mergeRequirements(cwd: string, names: string[]): Promise<void> {
    const requirementsPath = path.join(cwd, REQUIREMENTS_FILE);
    let existing = "";
    if (fs.existsSync(requirementsPath)) {
      existing = await fs.promises.readFile(requirementsPath, "utf8");
    }

    const byName = new Map<string, string>();
    for (const line of existing.split("\n")) {
      const spec = this.parseSpec(line);
      if (spec) {
        byName.set(spec.name, line.trim());
      }
    }
    for (const raw of names) {
      const spec = this.parseSpec(raw);
      if (spec) {
        byName.set(spec.name, raw.trim());
      }
    }
    const merged = Array.from(byName.values()).join("\n") + "\n";
    await fs.promises.writeFile(requirementsPath, merged);
  }

  private parseSpec(line: string): Package | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return null;
    }
    const match = trimmed.match(/^([A-Za-z0-9_.\-]+)\s*([<>=!~].+)?$/);
    if (!match) {
      return null;
    }
    return {name: match[1], version: (match[2] || "").trim(), types: {}};
  }
}
