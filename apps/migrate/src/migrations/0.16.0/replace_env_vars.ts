import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const functionCollection = ctx.database.collection("function");
  const functions = await functionCollection.find({}).toArray();

  const envVarCollection = ctx.database.collection("env_var");

  const bulkOps = [];

  for (let func of functions) {
    const envVars = [];
    Object.entries(func.env_vars).forEach(([key, value]) => envVars.push({key, value}));

    if (envVars.length) {
      await envVarCollection.insertMany(envVars);
    }

    bulkOps.push({
      updateOne: {filter: {_id: func._id}, update: {$set: {env_vars: envVars.map(v => v._id)}}}
    });
  }

  if (bulkOps.length) {
    await functionCollection.bulkWrite(bulkOps);
  }
}
