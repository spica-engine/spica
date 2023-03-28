const example = {
  line: `{"title": "line title",
  "options": {"legend": {"display": true},"responsive": true},"label": ["A", "B", "C", "D", "E", "F"],
  "datasets": [{"data": [65, 59, 90, 81, 56, 55, 40], "label": "linedata"}],
  "legend": true,
  "width": 70,
  "filters": [
    {"key": "begin","type": "date","value": "2000-01-01T00:00:00.000Z"},{"key": "end","type": "date","value": "2001-01-01T00:00:00.000Z"}
  ]
}`,
  radar: `{
    "title": "radar title",
    "options": { "legend": { "display": true }, "responsive": true },
    "label": ["Eating", "Drinking", "Sleeping", "Designing", "Coding", "Cycling", "Running"],
    "datasets": [
      { "data": [65, 59, 90, 81, 56, 55, 40], "label": "radardata" },
      { "data": [28, 48, 40, 19, 96, 27, 100], "label": "Series B" }
    ],
    "legend": true,
    "width": 30,
    "filters": [
      { "key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z" },
      { "key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z" }
    ]
  }`,
  bar: `{
    "title": "bar title",
    "options": { "legend": { "display": true }, "responsive": true },
    "label": ["2006", "2007", "2008", "2009", "2010", "2011", "2012"],
    "datasets": [
      { "data": [65, 59, 80, 81, 56, 55, 40], "label": "bardata" },
      { "data": [28, 48, 40, 19, 86, 27, 90], "label": "Series B" }
    ],
    "legend": true,
    "filters": [
      { "key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z" },
      { "key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z" }
    ]
  }`,
  pie: `{
    "title": "pie title",
    "options": { "legend": { "display": true }, "responsive": true },
    "label": [["piedata", "Sales"], ["In", "Store", "Sales"], "Mail Sales"],
    "data": [300, 500, 100],
    "legend": true,
    "filters": [
      { "key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z" },
      { "key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z" }
    ]
  }`,
  doughnut: `{
    "title": "doughnut title",
    "options": { "legend": { "display": true }, "responsive": true },
    "label": ["doughnutdata Sales", "In-Store Sales", "Mail-Order Sales"],
    "data": [[350, 450, 100], [50, 150, 120], [250, 130, 70]],
    "legend": true,
    "filters": [
      { "key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z" },
      { "key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z" }
    ]
  }`,
  bubble: `{
    "title": "buble title",
    "options": {
      "responsive": true,
      "scales": {
        "xAxes": [{ "ticks": { "min": 0, "max": 30 } }],
        "yAxes": [{ "ticks": { "min": 0, "max": 30 } }]
      }
    },
    "datasets": [
      {
        "data": [
          { "x": 10, "y": 10, "r": 10 },
          { "x": 15, "y": 5, "r": 15 },
          { "x": 26, "y": 12, "r": 23 },
          { "x": 7, "y": 8, "r": 8 }
        ],
        "label": "bubbledata"
      }
    ],
    "legend": true,
    "filters": [
      { "key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z" },
      { "key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z" }
    ]
  }
  `,
  scatter: `{
    "title": "scatter title",
    "options": {
      "responsive": true
    },
    "datasets": [
      {
        "data": [
          { "x": 1, "y": 1 },
          { "x": 2, "y": 3 },
          { "x": 3, "y": -2 },
          { "x": 4, "y": 4 },
          { "x": 5, "y": -3, "r": 20 }
        ],
        "label": "scatterdata",
        "pointRadius": 10
      }
    ],
    "legend": true,
    "filters": [
      { "key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z" },
      { "key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z" }
    ]
  }`,
  polarArea: `{
    "title": "polar title",
    "options": {
      "responsive": true
    },
    "data": [300, 500, 100, 40, 120],
    "legend": true,
    "filters": [
      { "key": "begin", "type": "date", "value": "2000-01-01T00:00:00.000Z" },
      { "key": "end", "type": "date", "value": "2001-01-01T00:00:00.000Z" }
    ]
  }`,
  table: `{
    "title": "table title",
    "data": [
      { "position": 1, "name": "Hydrogen", "weight": 1.0079, "symbol": "H", "asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde"},
      { "position": 2, "name": "Helium", "weight": 4.0026, "symbol": "He","asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" },
      { "position": 3, "name": "Lithium", "weight": 6.941, "symbol": "Li","asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" },
      { "position": 4, "name": "Beryllium", "weight": 9.0122, "symbol": "Be","asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" },
      { "position": 5, "name": "Boron", "weight": 10.811, "symbol": "B","asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" },
      { "position": 6, "name": "Carbon", "weight": 12.0107, "symbol": "C", "asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" },
      { "position": 7, "name": "Nitrogen", "weight": 14.0067, "symbol": "N","asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" },
      { "position": 8, "name": "Oxygen", "weight": 15.9994, "symbol": "O","asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" },
      { "position": 9, "name": "Fluorine", "weight": 18.9984, "symbol": "F","asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" },
      { "position": 10, "name": "Neon", "weight": 20.1797, "symbol": "Ne","asdasd": "asdsqweqwe","aasdssdasd": "asdsqweqasdasde" }
    ],
    "displayedColumns": ["position", "name", "weight", "symbol","asdasd"],
    "filters": [{ "key": "name", "type": "string", "value": "['Hydrogen','Nitrogen']" }]
  }`,
  card: `{
    "title": "Card Title",
    "description": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. In quis libero quis ligula vulputate efficitur.",
    "inputs": [
      {
        "key": "input1",
        "type": "string",
        "value": "",
        "title": "First Input"
      },
      {
        "key": "input2",
        "type": "string",
        "value": "",
        "title": "Second Input"
      }
    ],
    "button": {
      "color": "primary",
      "target": "http://",
      "method": "get",
      "title": "Send Request"
    }
  }
  `,
  statistic: `
  {
    "icon": {
      "name": "attach_money",
      "color": "white",
      "background_color": "#28ab24"
    },
    "main": {
      "title": "Application Usage",
      "color": "white",
      "value": "Profit"
    },
    "difference": {
      "value": 20,
      "title": "Compared to last week"
    }
  }
  `
};

export {example};
