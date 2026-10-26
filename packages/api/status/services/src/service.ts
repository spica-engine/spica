import {Inject, Injectable} from "@nestjs/common";
import {ApiStatus, STATUS_REPOSITORY, StatusRepository} from "@spica-server/interface-status";

@Injectable()
export class StatusService {
  constructor(@Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository) {}

  private byteToMb(bytes: number) {
    return parseFloat((bytes * Math.pow(10, -6)).toFixed(2));
  }

  record(status: Omit<ApiStatus, "_id" | "count">) {
    return this.statuses.record(status);
  }

  async _getStatus(begin: Date, end: Date) {
    const result = await this.statuses.summarize(
      this.isValidDate(begin) && this.isValidDate(end) ? {from: begin, to: end} : undefined
    );
    return {
      request: {
        current: result.request,
        unit: "count"
      },
      uploaded: {
        current: this.byteToMb(result.uploaded),
        unit: "mb"
      },
      downloaded: {
        current: this.byteToMb(result.downloaded),
        unit: "mb"
      }
    };
  }

  private isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }
}
