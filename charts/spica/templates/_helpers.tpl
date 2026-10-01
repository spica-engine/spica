{{- /*
The connection given to functions. Produced only on PostgreSQL and when `functions.enabled`.

The password is inside the URI, but the URI is kept **in a secret** and handed to the API as an env
var — passing it as an argument would write it into the pod definition (visible via
`kubectl describe`).
*/ -}}
{{- define "database.functions-uri" -}}
    {{- if not (include "database.is-postgres" .) -}}
    {{- else if not .Values.database.functions.enabled -}}
    {{- else if .Values.database.functions.externalUri -}}
        {{- .Values.database.functions.externalUri -}}
    {{- else -}}
        {{- $host := printf "%s-database.%s.svc.cluster.local" .Release.Name .Release.Namespace -}}
        {{- $user := .Values.database.functions.username | default "spica_functions" -}}
        {{- $pass := required "database.functions.enabled is true, so database.functions.password (or externalUri) must be provided." .Values.database.functions.password -}}
        {{- printf "postgres://%s:%s@%s:%v/%s" $user $pass $host .Values.database.postgres.port .Values.database.name -}}
    {{- end -}}
{{- end -}}

{{- /*
Backend selection in one place: the templates ask `database.is-postgres` and `database.bundled`
rather than comparing the backend name themselves. Spreading the same condition across ten templates
would mean missing one when a backend is added.
*/ -}}
{{- define "database.is-postgres" -}}
    {{- eq (.Values.database.backend | default "mongodb") "postgres" | ternary "true" "" -}}
{{- end -}}

{{- /* Does the chart create the database itself? Not when an external URI is given. */ -}}
{{- define "database.bundled" -}}
    {{- empty .Values.database.external.uri | ternary "true" "" -}}
{{- end -}}

{{- /*
The connection URI. The order: an external URI → the PostgreSQL service → the Mongo replica set
members.

The credentials are **not embedded** into the URI; the API takes them from the
`DATABASE_USERNAME`/`DATABASE_PASSWORD` env vars and adds them to the URI (the middleware in
`apps/api/src/main.ts`). That way the password appears neither in the manifest nor in the pod
arguments.
*/ -}}
{{- define "database.connection-uri" -}}
    {{- if .Values.database.external.uri -}}
        {{- .Values.database.external.uri | quote -}}
    {{- else if include "database.is-postgres" . -}}
        {{- $host := printf "%s-database.%s.svc.cluster.local" .Release.Name .Release.Namespace -}}
        {{- printf "postgres://%s:%v/%s" $host .Values.database.postgres.port .Values.database.name | quote -}}
    {{- else -}}
        {{- $uri := "mongodb://" -}}
        {{- $namespace := printf "%s-database" .Release.Name -}}
        {{- $ns := .Release.Namespace -}}
        {{- range $index := until (.Values.database.replicas | int) -}}
            {{- $node := printf "%s-%d.%s.%s.svc.cluster.local," $namespace $index $namespace $ns -}}
            {{- $uri = printf "%s%s" $uri $node -}}
        {{- end -}}
        {{- printf $uri | trimSuffix "," | quote -}}
    {{- end -}}
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
