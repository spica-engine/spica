import {PipeTransform, HttpException, HttpStatus} from "@nestjs/common";
// It has to be the SAME copy as `index.ts` — otherwise, before `isId()` existed, `instanceof` checks
// would silently take the wrong branch (see the note in index.ts).
import {ObjectId} from "bson";

export const OBJECT_ID: PipeTransform<string> = {
  transform: value => {
    if (!value) {
      throw new HttpException("Invalid id.", HttpStatus.BAD_REQUEST);
    }
    try {
      return new ObjectId(value);
    } catch (error) {
      throw new HttpException("Invalid id.", HttpStatus.BAD_REQUEST);
    }
  }
};
