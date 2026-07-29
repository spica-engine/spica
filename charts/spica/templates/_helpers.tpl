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
