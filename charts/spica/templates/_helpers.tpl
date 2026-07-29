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


{{- define "database.primaryNode" -}}
{{- $name := printf "%s-database" .Release.Name -}}
{{- printf "%s-0.%s.%s.svc.cluster.local" $name $name .Release.Namespace -}}
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


{{- define "generatePassword" -}}
  {{- $specialChars := list "!" "@" "#" "$" "%" "^" "&" "*" "-" "_" -}}
  {{- $body := list
        (randAlpha 2)
        (randNumeric 2)
        (index $specialChars (randInt 0 (len $specialChars)))
        (index $specialChars (randInt 0 (len $specialChars)))
        (randAlphaNum 6)
      | join "" | shuffle
  -}}
  {{- /* Leading char is kept alphabetic: a password starting with "-" is parsed as a flag by
         mongosh and yargs, which silently breaks every --password consumer in this chart. */ -}}
  {{- printf "%s%s" (randAlpha 1) $body -}}
{{- end -}}
