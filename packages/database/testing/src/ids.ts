import {bindIdTypes} from "@spica-server/data";
import {MongoIdTypes} from "@spica-server/data-mongodb";

bindIdTypes(new MongoIdTypes());
