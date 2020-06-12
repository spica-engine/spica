## Dashboard

Dashboard module allows you to create a new custome dashboard including custom data charts or table. The only way to creating a custom dashboard is writing a function in your Spica instance. You have to import and use dashboard library provided by Spica instance in your function. You can seed the dashboard module with any data. So you can take data from buckets, database or even other 3rd party integration. You can create multiple dashboards and once you activated a new dashboard, you can see your dashboard on the left hand menu.

> IMPORTANT: We suggest you to initiate a dashboard with an `HTTP` trigger or `SYSTEM:READY` trigger. Otherwise your custom dashboard may be initiated multiple times. This may cause repeated dashboard on the left side menu. Dashboard module does not control how many times you initiated a dashboard.

Define a dashboard:

```typescript
export default function(req, res) {
  const linedata: Charts.Response = {
    linedata: {
      title:"line title",
      options: {legend: {display: true}, responsive: true},
      label: ["1", "2", "3", "4", "5", "6"],
      datasets: [{data: [65, 59, 90, 81, 56, 55, 40], label: "linedata"}],,
      legend: true,
      width:70,
      filters:[{key:'line_data_filter',title:'Please enter filter',type:"string"}]
    }
  };
  const radardata: Charts.Response = {
    radardata: {
      title:"radar title",
      options: {legend: {display: true}, responsive: true},
      label: ["Eating", "Drinking", "Sleeping", "Designing", "Coding", "Cycling", "Running"],
      datasets: [
        {data: [65, 59, 90, 81, 56, 55, 40], label: "radardata"},
        {data: [28, 48, 40, 19, 96, 27, 100], label: "Series B"}
      ],
      legend: true,
      width:30
    }
  };
  const bardata: Charts.Response = {
    bardata: {
      title:"bar title",
      options: {legend: {display: true}, responsive: true},
      label: ["2006", "2007", "2008", "2009", "2010", "2011", "2012"],
      datasets: [
        {data: [65, 59, 80, 81, 56, 55, 40], label: "bardata"},
        {data: [28, 48, 40, 19, 86, 27, 90], label: "Series B"}
      ],
      legend: true
    }
  };
  const piedata: Charts.Response = {
    piedata: {
      title:"pie title",
      options: {legend: {display: true}, responsive: true},
      label: [["piedata", "Sales"], ["In", "Store", "Sales"], "Mail Sales"],
      data: [300, 500, 100],
      legend: true
    }
  };
  const doughnutdata: Charts.Response = {
    doughnutdata: {
      title:"doughnot title",
      options: {legend: {display: true}, responsive: true},
      label: ["doughnutdata Sales", "In-Store Sales", "Mail-Order Sales"],
      data: [[350, 450, 100], [50, 150, 120], [250, 130, 70]],
      legend: true
    }
  };
  const bubbledata: Charts.Response = {
    bubbledata: {
      title:"buble title",
      options: {
        responsive: true,
        scales: {
          xAxes: [
            {
              ticks: {
                min: 0,
                max: 30
              }
            }
          ],
          yAxes: [
            {
              ticks: {
                min: 0,
                max: 30
              }
            }
          ]
        }
      },
      datasets: [
        {
          data: [
            {x: 10, y: 10, r: 10},
            {x: 15, y: 5, r: 15},
            {x: 26, y: 12, r: 23},
            {x: 7, y: 8, r: 8}
          ],
          label: "bubbledata"
        }
      ],
      legend: true
    }
  };
  const scatterdata: Charts.Response = {
    scatterdata: {
       title:"scatter title",
      options: {
        responsive: true
      },
      datasets: [
        {
          data: [{x: 1, y: 1}, {x: 2, y: 3}, {x: 3, y: -2}, {x: 4, y: 4}, {x: 5, y: -3, r: 20}],
          label: "scatterdata",
          pointRadius: 10
        }
      ],
      legend: true
    }
  };
  const polarAreadata: Charts.Response = {
    polarAreadata: {
       title:"polar title",
      options: {
        responsive: true
      },
      data: [300, 500, 100, 40, 120],
      legend: true
    }
  };
  const tabledata: Table.Response = {
    tabledata: {
       title:"table title",
      data: [
        {position: 1, name: "Hydrogen", weight: 1.0079, symbol: "H"},
        {position: 2, name: "Helium", weight: 4.0026, symbol: "He"},
        {position: 3, name: "Lithium", weight: 6.941, symbol: "Li"},
        {position: 4, name: "Beryllium", weight: 9.0122, symbol: "Be"},
        {position: 5, name: "Boron", weight: 10.811, symbol: "B"},
        {position: 6, name: "Carbon", weight: 12.0107, symbol: "C"},
        {position: 7, name: "Nitrogen", weight: 14.0067, symbol: "N"},
        {position: 8, name: "Oxygen", weight: 15.9994, symbol: "O"},
        {position: 9, name: "Fluorine", weight: 18.9984, symbol: "F"},
        {position: 10, name: "Neon", weight: 20.1797, symbol: "Ne"}
      ],
      displayedColumns: ["position", "name", "weight", "symbol"]
    }
  };
  response.send([
    bubbledata,
    scatterdata,
    linedata,
    piedata,
    radardata,
    doughnutdata,
    polarAreadata,
    bardata,
    tabledata
  ]);
}
```

And initialize dashboards on another function:

```typescript
// Add `@spica-devkit/dashboard` to your dependencies and import it
import * as Dashboard from "@spica-devkit/dashboard";
export default async function () {
  // Create an API key and initialize dashboards with it
  Dashboard.initialize(<APIKEY>);
  let dashboard = await Dashboard.create({
    key: "unique_key",
    name: "Line Chart", // This name will be shown on Spica Client
    icon: "none",
    components: [
      {
        type: "line",
        // Url of your dashobard function
        url: "http://localhost:4300/fn-execute/line",
        key: "linedata",
      },
    ],
  });
}
```

To see your custom dashboards, please navigate to **Primary** section on the menu.
