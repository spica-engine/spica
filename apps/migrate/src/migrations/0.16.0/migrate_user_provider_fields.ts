import {Context} from "../../migrate";

/**
 * Migrates user email/phone fields from the old shape:
 *   { encrypted, iv, authTag, hash?, createdAt }
 * to the new shape:
 *   email/phone: { encrypted, iv, authTag, hash }
 *   email_verified_at / phone_verified_at: Date
 *
 * Also removes the old `createdAt` field from the sub-document.
 */
export default async function(ctx: Context) {
  const userCollection = ctx.database.collection("user");

  const usersWithEmail = await userCollection.find({"email.createdAt": {$exists: true}}).toArray();

  for (const user of usersWithEmail) {
    const update: Record<string, any> = {
      $set: {email_verified_at: user.email.createdAt},
      $unset: {"email.createdAt": ""}
    };

    await userCollection.updateOne({_id: user._id}, update);
  }

  const usersWithPhone = await userCollection.find({"phone.createdAt": {$exists: true}}).toArray();

  for (const user of usersWithPhone) {
    const update: Record<string, any> = {
      $set: {phone_verified_at: user.phone.createdAt},
      $unset: {"phone.createdAt": ""}
    };

    await userCollection.updateOne({_id: user._id}, update);
  }
}
