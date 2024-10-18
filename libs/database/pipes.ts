import {PipeTransform, HttpException, HttpStatus} from "@nestjs/common";
import {ObjectId} from "mongodb";

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
