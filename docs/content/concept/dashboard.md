# Dashboard

## Table of contents

The dashboard module allows you to create a new custom dashboard including custom data charts or tables.

To list all of your Dashboards, simply open the **Primary** section of the side panel and click to the **list** icon.

## Creating a new custom Dashboard

A basic custom dashboard consists of two properties; a name and components. You can show many different components in a dashboard by adding multiple components.

URL property of the component dedicates where the chart data comes from. You can choose to get data directly from Spica by using an HTTP Triggered function, or you can enter a remote URL.

Please note, each component accepts takes a different kind of JSON structure.
### Example Line Data

```json
{
  "title": "line title",
  "options": {"legend": {"display": true}, "responsive": true},
  "label": ["A", "B", "C", "D", "E", "F"],
  "datasets": [{"data": [65, 59, 90, 81, 56, 55, 40], "label": "linedata"}],
  "legend": true,
  "width": 70,
  "filters": [
    {"key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z"},
    {"key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z"}
  ]
}
```

### Example Radar Data

```json
{
  "title": "radar title",
  "options": {"legend": {"display": true}, "responsive": true},
  "label": ["Eating", "Drinking", "Sleeping", "Designing", "Coding", "Cycling", "Running"],
  "datasets": [
    {"data": [65, 59, 90, 81, 56, 55, 40], "label": "radardata"},
    {"data": [28, 48, 40, 19, 96, 27, 100], "label": "Series B"}
  ],
  "legend": true,
  "width": 30,
  "filters": [
    {"key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z"},
    {"key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z"}
  ]
}
```

### Example Bar Data

```json
{
  "title": "bar title",
  "options": {"legend": {"display": true}, "responsive": true},
  "label": ["2006", "2007", "2008", "2009", "2010", "2011", "2012"],
  "datasets": [
    {"data": [65, 59, 80, 81, 56, 55, 40], "label": "bardata"},
    {"data": [28, 48, 40, 19, 86, 27, 90], "label": "Series B"}
  ],
  "legend": true,
  "filters": [
    {"key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z"},
    {"key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z"}
  ]
}
```

### Example Pie Data

```json
{
  "title": "pie title",
  "options": {"legend": {"display": true}, "responsive": true},
  "label": [["piedata", "Sales"], ["In", "Store", "Sales"], "Mail Sales"],
  "data": [300, 500, 100],
  "legend": true,
  "filters": [
    {"key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z"},
    {"key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z"}
  ]
}
```

### Example Doughnut Data

```json
{
  "title": "doughnut title",
  "options": {"legend": {"display": true}, "responsive": true},
  "label": ["doughnutdata Sales", "In-Store Sales", "Mail-Order Sales"],
  "data": [[350, 450, 100], [50, 150, 120], [250, 130, 70]],
  "legend": true,
  "filters": [
    {"key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z"},
    {"key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z"}
  ]
}
```

### Example Bubble Data

```json
{
  "title": "buble title",
  "options": {
    "responsive": true,
    "scales": {
      "xAxes": [{"ticks": {"min": 0, "max": 30}}],
      "yAxes": [{"ticks": {"min": 0, "max": 30}}]
    }
  },
  "datasets": [
    {
      "data": [
        {"x": 10, "y": 10, "r": 10},
        {"x": 15, "y": 5, "r": 15},
        {"x": 26, "y": 12, "r": 23},
        {"x": 7, "y": 8, "r": 8}
      ],
      "label": "bubbledata"
    }
  ],
  "legend": true,
  "filters": [
    {"key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z"},
    {"key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z"}
  ]
}
```

### Example Scatter Data

```json
{
  "title": "scatter title",
  "options": {
    "responsive": true
  },
  "datasets": [
    {
      "data": [
        {"x": 1, "y": 1},
        {"x": 2, "y": 3},
        {"x": 3, "y": -2},
        {"x": 4, "y": 4},
        {"x": 5, "y": -3, "r": 20}
      ],
      "label": "scatterdata",
      "pointRadius": 10
    }
  ],
  "legend": true,
  "filters": [
    {"key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z"},
    {"key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z"}
  ]
}
```

### Example Polar Data

```json
{
  "title": "polar title",
  "options": {
    "responsive": true
  },
  "data": [300, 500, 100, 40, 120],
  "legend": true,
  "filters": [
    {"key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z"},
    {"key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z"}
  ]
}
```

### Example Table Data

```json
{
  "title": "table title",
  "data": [
    {"position": 1, "name": "Hydrogen", "weight": 1.0079, "symbol": "H"},
    {"position": 2, "name": "Helium", "weight": 4.0026, "symbol": "He"},
    {"position": 3, "name": "Lithium", "weight": 6.941, "symbol": "Li"},
    {"position": 4, "name": "Beryllium", "weight": 9.0122, "symbol": "Be"},
    {"position": 5, "name": "Boron", "weight": 10.811, "symbol": "B"},
    {"position": 6, "name": "Carbon", "weight": 12.0107, "symbol": "C"},
    {"position": 7, "name": "Nitrogen", "weight": 14.0067, "symbol": "N"},
    {"position": 8, "name": "Oxygen", "weight": 15.9994, "symbol": "O"},
    {"position": 9, "name": "Fluorine", "weight": 18.9984, "symbol": "F"},
    {"position": 10, "name": "Neon", "weight": 20.1797, "symbol": "Ne"}
  ],
  "displayedColumns": ["position", "name", "weight", "symbol"],
  "filters": [{"key": "name", "type": "string", "value": "['Hydrogen','Nitrogen']"}]
}
```

To see your custom dashboards, please navigate to **Primary** section on the menu.
