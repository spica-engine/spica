{{- define "database.connection-uri" -}}
    {{- $uri := "mongodb://" -}}
    {{- $namespace := printf "%s-database" .Release.Name -}}
    {{- $ns := .Release.Namespace -}}
    {{- range $index := until (.Values.database.replicas | int) -}}
        {{- $node := printf "%s-%d.%s.%s.svc.cluster.local," $namespace $index $namespace $ns -}}
        {{- $uri = printf "%s%s" $uri $node -}}
    {{- end -}}
    {{- printf $uri | trimSuffix "," | quote -}}
{{- end -}}


{{- define "database.nodes" -}}
    {{- $uri := "" -}}
    {{- $namespace := printf "%s-database" .Release.Name -}}
    {{- $ns := .Release.Namespace -}}
    {{- range $index := until (.Values.database.replicas | int) -}}
        {{- $node := printf "\"%s-%d.%s.%s.svc.cluster.local\"" $namespace $index $namespace $ns -}}
        {{- $uri = printf "%s%s," $uri $node -}}
    {{- end -}}
    {{- printf $uri | trimSuffix "," -}}
{{- end -}}


{{- define "generateReplicaSetMembers" -}}
{{- $replicaCount := (.Values.database.replicas | int) -}}
{{- $uri := "" -}}
{{- $namespace := printf "%s-database" .Release.Name -}}
{{- $ns := .Release.Namespace -}}
[
{{- range $index, $ := until $replicaCount -}}
  {{- if ne $index 0 }},{{- end -}}
  {{- $node := printf "\"%s-%d.%s.%s.svc.cluster.local\"" $namespace $index $namespace $ns -}}
  {"_id": {{ $index }}, "host": {{ $node }} }
{{- end -}}
]
{{- end -}}


{{- /*
Generated passwords reach mongosh and yargs as CLI flag values, and are embedded into
single-quoted shell strings and JS string literals. Two invariants keep that safe:

  - the first character stays alphanumeric, because a value opening with "-" is parsed as
    the start of another flag rather than as the value of the preceding one
  - $specialChars must never contain "'" or "\", which terminate the surrounding string
    literal or introduce an escape sequence

Every other punctuation character here survives all of those contexts unaltered.
*/ -}}
{{- define "generatePassword" -}}
  {{- $specialChars := list "!" "@" "#" "$" "%" "^" "&" "*" "-" "_" -}}
  {{- $body := list
        (randAlpha 1)
        (randNumeric 2)
        (index $specialChars (randInt 0 (len $specialChars)))
        (index $specialChars (randInt 0 (len $specialChars)))
        (randAlphaNum 6)
      | join "" | shuffle
  -}}
  {{- printf "%s%s" (randAlphaNum 1) $body -}}
{{- end -}}

{{/*
Disk mode of the API pods: ReadWriteOnce (StatefulSet, a volume per pod), ReadWriteMany (Deployment,
one shared volume) or Diskless (Deployment, emptyDir, functions restored from prebuilt archives).
An empty diskAccessMode means Diskless, except for releases whose StatefulSet already exists: they
relied on the former ReadWriteOnce default and must not switch on upgrade.
*/}}
{{- define "spica.diskMode" -}}
{{- $mode := .Values.application.diskAccessMode | default "" -}}
{{- if $mode -}}
  {{- if not (has $mode (list "ReadWriteOnce" "ReadWriteMany")) -}}
    {{- fail (printf "application.diskAccessMode must be ReadWriteOnce, ReadWriteMany or empty (diskless), got %q" $mode) -}}
  {{- end -}}
  {{- $mode -}}
{{- else if lookup "apps/v1" "StatefulSet" .Release.Namespace (printf "%s-application" .Release.Name) -}}
ReadWriteOnce
{{- else -}}
Diskless
{{- end -}}
{{- end -}}

{{/*
Value of a flag in application.args, given as either "--flag", "value" or "--flag=value".
Usage: include "spica.argValue" (list "--flag" .Values.application.args)
*/}}
{{- define "spica.argValue" -}}
{{- $flag := index . 0 -}}
{{- $result := "" -}}
{{- $takeNext := false -}}
{{- range (index . 1) -}}
  {{- $arg := toString . -}}
  {{- if $takeNext -}}
    {{- $result = $arg -}}
    {{- $takeNext = false -}}
  {{- else if eq $arg $flag -}}
    {{- $takeNext = true -}}
  {{- else if hasPrefix (printf "%s=" $flag) $arg -}}
    {{- $result = trimPrefix (printf "%s=" $flag) $arg -}}
  {{- end -}}
{{- end -}}
{{- $result -}}
{{- end -}}

{{- define "spica.functionAssets.gcsServiceAccountPath" -}}
{{- $gcs := .Values.application.functionAssets.gcs -}}
{{- if $gcs.serviceAccountPath -}}
{{- $gcs.serviceAccountPath -}}
{{- else if $gcs.serviceAccountSecret -}}
{{- printf "/etc/spica/function-assets-gcs/%s" ($gcs.serviceAccountSecretKey | default "key.json") -}}
{{- end -}}
{{- end -}}

{{/*
Diskless pods keep nothing across restarts, so everything under /data must be rebuildable:
function code from the function asset bucket, and no storage objects on the local disk.
*/}}
{{- define "spica.validateDiskless" -}}
{{- $args := .Values.application.args -}}
{{- $assets := .Values.application.functionAssets -}}
{{- $strategy := $assets.strategy | default (include "spica.argValue" (list "--function-asset-storage-strategy" $args)) -}}
{{- $bucket := "" -}}
{{- if eq $strategy "awss3" -}}
  {{- $bucket = $assets.awss3.bucketName | default (include "spica.argValue" (list "--function-asset-awss3-bucket-name" $args)) -}}
{{- else if eq $strategy "gcs" -}}
  {{- $bucket = $assets.gcs.bucketName | default (include "spica.argValue" (list "--function-asset-gcs-bucket-name" $args)) -}}
{{- end -}}
{{- if not $bucket -}}
  {{- fail "Diskless mode (application.diskAccessMode is empty) needs a function asset bucket: set application.functionAssets.strategy to awss3 or gcs with its bucketName, or set application.diskAccessMode to ReadWriteOnce or ReadWriteMany." -}}
{{- end -}}
{{- $storageStrategy := include "spica.argValue" (list "--storage-strategy" $args) | default "default" -}}
{{- if eq $storageStrategy "default" -}}
  {{- fail "Diskless mode (application.diskAccessMode is empty) cannot keep storage objects on the pod disk: add --storage-strategy gcloud or awss3 (with its bucket options) to application.args, or set application.diskAccessMode to ReadWriteOnce or ReadWriteMany." -}}
{{- end -}}
{{- end -}}
