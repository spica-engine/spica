import {ArtifactGarbageCollector} from "./artifact-gc.js";
import {ArtifactIdentity} from "./artifact-identity.js";
import {ArtifactStore} from "./artifact-store.js";
import {FunctionArtifactSync} from "./artifact-sync.js";
import {FunctionArtifactWatcher} from "./artifact-watcher.js";
import {ArtifactWorkspace} from "./artifact-workspace.js";

export {FunctionArtifactSync};

export const ARTIFACT_PROVIDERS = [
  ArtifactIdentity,
  ArtifactWorkspace,
  ArtifactStore,
  ArtifactGarbageCollector,
  FunctionArtifactSync,
  FunctionArtifactWatcher
];
