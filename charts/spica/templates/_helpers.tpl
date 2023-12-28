{{- define "database.connection-uri" -}}
    {{- $uri := "mongodb://" -}}
    {{- $uri = printf "%s%s:%s@" $uri .Values.database.username .Values.database.password }}
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