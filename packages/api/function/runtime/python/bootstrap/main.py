"""Spica function Python runtime bootstrap.

Spawned by the API as a child process. Connects to the function gRPC event
queue, pops events, dynamically imports the user's handler from
``<cwd>/.build/index.py`` and invokes it. Mirrors the contract implemented in
``packages/api/function/runtime/node/bootstrap/entrypoint.ts``.

Phase 1 supports HTTP, SCHEDULE and DATABASE triggers.
"""

import asyncio
import importlib.util
import inspect
import os
import sys
import traceback
from pathlib import Path

# Make ``spica_runtime`` importable regardless of how this script is launched.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from spica_runtime.queue import EventQueueClient  # noqa: E402
from spica_runtime.dispatch import build_call_arguments  # noqa: E402
from spica_runtime._pb import event_pb2  # noqa: E402


def _exit_abnormally(reason: str) -> "NoReturn":  # type: ignore[name-defined]
    print(reason, file=sys.stderr, flush=True)
    sys.exit(126)


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        _exit_abnormally(f"Environment variable {name} was not set.")
    return value


def _load_user_module(cwd: str, entrypoint: str, event_id: str):
    """Load ``cwd/.build/<entrypoint>`` under a synthetic module name.

    Using a unique name per event mirrors the ``?event=<id>`` cache-buster the
    Node bootstrap appends to ``import()``: redeploys can't be served from a
    stale module cache.
    """
    file_path = Path(cwd) / ".build" / entrypoint
    if not file_path.exists():
        _exit_abnormally(f"Function entrypoint not found at {file_path}.")

    module_name = f"spica_user_fn_{event_id.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        _exit_abnormally(f"Failed to load function entrypoint at {file_path}.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        traceback.print_exc()
        raise
    return module


def _invoke(handler, args):
    result = handler(*args)
    if inspect.iscoroutine(result):
        return asyncio.get_event_loop().run_until_complete(result)
    return result


def _process_event(ev, queue: EventQueueClient) -> None:
    target = ev.target
    try:
        os.chdir(target.cwd)
    except OSError as exc:
        print(f"Failed to chdir into {target.cwd}: {exc}", file=sys.stderr, flush=True)
        queue.complete(ev.id, succeeded=False)
        return

    os.environ["TIMEOUT"] = str(int(target.context.timeout))
    for env in target.context.env:
        os.environ[env.key] = env.value

    # Make per-function deps and sibling Python functions importable.
    function_root = target.cwd
    function_packages = os.path.join(function_root, ".python_packages")
    functions_root = os.path.dirname(function_root.rstrip(os.sep))
    for path in (function_packages, function_root, functions_root):
        if path and path not in sys.path:
            sys.path.insert(0, path)

    try:
        call_args, callback = build_call_arguments(ev, queue)
    except Exception:
        traceback.print_exc()
        queue.complete(ev.id, succeeded=False)
        return

    if call_args is None:
        # An unsupported trigger type or queue-pop error. ``build_call_arguments``
        # has already completed the event.
        return

    entrypoint = os.environ.get("ENTRYPOINT", "index.py")
    try:
        module = _load_user_module(target.cwd, entrypoint, ev.id)
    except Exception:
        queue.complete(ev.id, succeeded=False)
        return

    handler_name = target.handler
    handler = getattr(module, handler_name, None)
    if handler is None:
        queue.complete(ev.id, succeeded=False)
        _exit_abnormally(
            f"This function does not export any symbol named '{handler_name}'."
        )
    if not callable(handler):
        queue.complete(ev.id, succeeded=False)
        _exit_abnormally(
            f"This function does export a symbol named '{handler_name}' "
            "but it is not callable."
        )

    try:
        result = _invoke(handler, call_args)
        if callback is not None:
            cb_result = callback(result)
            if inspect.iscoroutine(cb_result):
                asyncio.get_event_loop().run_until_complete(cb_result)
        queue.complete(ev.id, succeeded=True)
    except Exception:
        traceback.print_exc()
        queue.complete(ev.id, succeeded=False)


def main() -> None:
    _require_env("FUNCTION_GRPC_ADDRESS")
    _require_env("ENTRYPOINT")
    worker_id = _require_env("WORKER_ID")

    queue = EventQueueClient()

    while True:
        try:
            ev = queue.pop(worker_id)
        except Exception as exc:  # noqa: BLE001
            # gRPC code 5 = NOT_FOUND => no event available; keep polling.
            code = getattr(exc, "code", None)
            try:
                code_value = code() if callable(code) else code
            except Exception:  # noqa: BLE001
                code_value = None
            if getattr(code_value, "value", code_value) in (5, "NOT_FOUND"):
                continue
            # Unrecoverable: log and exit so the scheduler can replace us.
            print(f"event queue pop failed: {exc}", file=sys.stderr, flush=True)
            sys.exit(1)

        if ev is None or ev.id == "":
            # Server signaled "no event" with an empty payload. Loop again.
            continue

        _process_event(ev, queue)


if __name__ == "__main__":
    main()
