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