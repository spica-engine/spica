import {Context} from "../../migrate";

export default async function(ctx: Context) {
  const coll = ctx.database.collection("storage");

  const storages = await coll.find().toArray();

  const promises = [];

  const rootDirPromise = coll.insertOne({name: "root/", content: {type: "", size: 0}});
  promises.push(rootDirPromise);

  for (const storage of storages) {
    const name = `root/${storage.name}`;
    const promise = coll.findOneAndUpdate({_id: storage._id}, {$set: {name: name}});
    promises.push(promise);
  }

  await Promise.all(promises);
}
