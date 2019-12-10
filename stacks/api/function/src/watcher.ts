import { Injectable, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "@spica-server/database";

@Injectable()
export class FunctionWatcher implements OnModuleInit{

    constructor(private db: DatabaseService) {
        
    }

    onModuleInit() {
       const watcher = this.db.collection('function').watch();
       watcher.on("change", change => {
        switch (change.operationType) {
            case "REPLACE":
                
                break;
        
            default:
                break;
        }
       })
    }
}