## Dashboard

The dashboard module allows you to create a new custom dashboard including custom data charts or tables. The only way to create a custom dashboard is to write a function in your Spica instance. You have to import and use the dashboard library `@spica-devkit/dashboard` in your function. You can seed the dashboard module with any data. You can fetch data from buckets, databases, or even from other 3rd party services. You can create multiple dashboards and once you activated a new dashboard, you can see your dashboard on the left menu.

> IMPORTANT: The best way to initiate a dashboard is through an `HTTP` trigger or `SYSTEM:READY` trigger. Otherwise, your custom dashboard may be initiated multiple times. thus may see duplicated dashboards on the left side menu. The dashboard module does not control how many times you registered a dashboard.

Define a dashboard:

```javascript
export function line(req, res) {
  var linedata = {
    linedata: {
      title:"line title",
      options: {legend: {display: true}, responsive: true},
      label: ["1", "2", "3", "4", "5", "6"],
      datasets: [{data: [65, 59, 90, 81, 56, 55, 40], label: "linedata"}],
      legend: true,
      width:70,
      filters:[{key:'line_data_filter',title:'Please enter filter',type:"string"}]
    }
  };
  var radardata = {
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
  var bardata = {
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
  var piedata = {
    piedata: {
      title:"pie title",
      options: {legend: {display: true}, responsive: true},
      label: [["piedata", "Sales"], ["In", "Store", "Sales"], "Mail Sales"],
      data: [300, 500, 100],
      legend: true
    }
  };
  var doughnutdata = {
    doughnutdata: {
      title:"doughnot title",
      options: {legend: {display: true}, responsive: true},
      label: ["doughnutdata Sales", "In-Store Sales", "Mail-Order Sales"],
      data: [[350, 450, 100], [50, 150, 120], [250, 130, 70]],
      legend: true
    }
  };
  var bubbledata = {
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
  var scatterdata = {
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
  var polarAreadata = {
    polarAreadata: {
       title:"polar title",
      options: {
        responsive: true
      },
      data: [300, 500, 100, 40, 120],
      legend: true
    }
  };
  var tabledata = {
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
  res.send([linedata,
       
    bubbledata,
    scatterdata,
    
    piedata,
    radardata,
    doughnutdata,
    polarAreadata,
    bardata,
    tabledata]
  );
}
```

And initialize dashboards on another function:

```javascript
// Add `@spica-devkit/dashboard` to your dependencies and import it
import * as Dashboard from "@spica-devkit/dashboard";
export default async function (req,res) {
  // Create an API key and initialize dashboards with it

  Dashboard.initialize("1i7z1kcoxehci");
  await Dashboard.remove('unique_key');
  let dashboard = await Dashboard.create({
    key: "unique_key",
    name: "Line Chart", // This name will be shown on Spica Client
    icon: "none",
    components: [
        {
        type: "bar",
        // Url of your dashobard function
        url: "https://master.spicaengine.com/api/fn-execute/line",
        key: "bardata",
      }, 
      {
        type: "table",
        // Url of your dashobard function
        url: "https://master.spicaengine.com/api/fn-execute/line",
        key: "tabledata",
      }, 
        {
        type: "polarArea",
        // Url of your dashobard function
        url: "https://master.spicaengine.com/api/fn-execute/line",
        key: "polarAreadata",
      }, 
      {
        type: "line",
        // Url of your dashobard function
        url: "https://master.spicaengine.com/api/fn-execute/line",
        key: "linedata",
      },      
      {
        type: "bubble",
        // Url of your dashobard function
        url: "https://master.spicaengine.com/api/fn-execute/line",
        key: "bubbledata",
      },      
      {
        type: "pie",
        // Url of your dashobard function
        url: "https://master.spicaengine.com/api/fn-execute/line",
        key: "piedata",
      },      
      {
        type: "doughnut",
        // Url of your dashobard function
        url: "https://master.spicaengine.com/api/fn-execute/line",
        key: "doughnutdata",
      },      
      {
        type: "radar",
        // Url of your dashobard function
        url: "https://master.spicaengine.com/api/fn-execute/line",
        key: "radardata",
      },
    ],
  });
  res.status(200).send(true);
}
```

To see your custom dashboards, please navigate to **Primary** section on the menu.
