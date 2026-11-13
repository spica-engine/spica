import {bindIdTypes} from "@spica-server/data";
import {PostgresIdTypes} from "@spica-server/data-postgresql";

bindIdTypes(new PostgresIdTypes({} as never));
