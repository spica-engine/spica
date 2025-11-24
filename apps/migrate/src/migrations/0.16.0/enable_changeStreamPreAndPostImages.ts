import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const collections = ["buckets", "function", "env_var", "policies"];

  for (const collectionName of collections) {
    try {
      const collectionInfo = await ctx.database.listCollections({name: collectionName}).toArray();

      if (!collectionInfo.length) {
        console.log(`[Migration] Collection "${collectionName}" does not exist, skipping...`);
        continue;
      }

      const currentInfo = collectionInfo[0] as any;
      const isAlreadyEnabled = currentInfo.options?.changeStreamPreAndPostImages?.enabled === true;

      if (isAlreadyEnabled) {
        console.log(
          `[Migration] Collection "${collectionName}" already has changeStreamPreAndPostImages enabled, skipping...`
        );
        continue;
      }

      await ctx.database.command({
        collMod: collectionName,
        changeStreamPreAndPostImages: {enabled: true}
      });

      console.log(
        `[Migration] Successfully enabled changeStreamPreAndPostImages for collection "${collectionName}"`
      );
    } catch (error) {
      console.error(
        `[Migration] Error enabling changeStreamPreAndPostImages for "${collectionName}":`,
        error.message
      );
      throw error;
    }
  }
}
