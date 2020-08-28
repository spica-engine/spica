import { ObjectId } from "@spica-server/database";

export function policyAggregation(state: any /* LastState*/) {
    let aggregation = [];
  
    // if (state.alloweds.length && !state.alloweds.includes("*")) {
    //   aggregation.push({
    //     $match: {
    //       _id: {
    //         $in: state.alloweds.filter(st => ObjectId.isValid(st)).map(st => new ObjectId(st))
    //       }
    //     }
    //   });
    // }
  
    // if (state.denieds.length && !state.denieds.includes("*")) {
    //   aggregation.length
    //     ? (aggregation[0]["$match"]["_id"]["$nin"] = state.denieds
    //         .filter(st => ObjectId.isValid(st))
    //         .map(st => new ObjectId(st)))
    //     : aggregation.push({
    //         $match: {
    //           _id: {
    //             $nin: state.denieds.filter(st => ObjectId.isValid(st)).map(st => new ObjectId(st))
    //           }
    //         }
    //       });
    // }
  
    return aggregation;
  }
  