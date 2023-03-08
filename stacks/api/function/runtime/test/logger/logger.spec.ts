// import {
//   getLoggerConsole,
//   getLogs,
//   LogChannels,
//   LogLevels
// } from "@spica-server/function/runtime/logger";

// // don't know why I can't listen data event of process
// process.stdout.addListener("data",(data) => console.log("DATATATATATA",data))

// describe("Logger", () => {
//   let loggerConsole: Console;

//   beforeEach(() => {
//     loggerConsole = getLoggerConsole();
//   });

//   describe("DEBUG", () => {
//     it("should set log level as debug", () => {
//       const date = new Date();

//       let msg = "";

//       const onDataListener = data => {
//         msg += data;
//       };

//       loggerConsole.debug("Debugging..");
//       loggerConsole.debug({keep: "json"});
//       loggerConsole.debug("multiple", `params`, date, 123, false, null);

//       const logs = getLogs(msg, LogChannels.OUT);
//       console.log(logs);
//       expect(logs).toEqual([
//         {
//           level: LogLevels.DEBUG,
//           message: "Debugging.."
//         },
//         {
//           level: LogLevels.DEBUG,
//           message: "{keep: 'json'}"
//         },
//         {
//           level: LogLevels.DEBUG,
//           message: `multiple params ${date.toISOString()} 123 false null`
//         }
//       ]);
//     });
//   });
// });
