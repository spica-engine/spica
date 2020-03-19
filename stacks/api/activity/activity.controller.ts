import {Controller, Get} from "@nestjs/common";
import {ActivityService} from "./activity.service";

@Controller("activity")
export class ActivityController {
  constructor(private activityService: ActivityService) {}
  @Get()
  findAll() {
    return this.activityService.find();
  }
}
