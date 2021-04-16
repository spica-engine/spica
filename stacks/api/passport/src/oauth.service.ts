import {Inject, Injectable} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {OAuthRequestDetails, OAuthStrategy, StrategyTypeService} from "./strategy/interface";
import {StrategyService} from "./strategy/strategy.service";
import axios from "axios";
import {PassportOptions, PASSPORT_OPTIONS} from "./options";

@Injectable()
export class OAuthService implements StrategyTypeService {
  constructor(
    private strategyService: StrategyService,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions
  ) {}
  prepareToInsert(strategy: OAuthStrategy) {}

  afterInsert(strategy: OAuthStrategy) {
    const redirectUrl = `${this.options.publicUrl}/passport/strategy/${strategy._id}/redirect`;
    return this.strategyService.findOneAndUpdate(
      {
        _id: new ObjectId(strategy._id)
      },
      {
        $set: {
          "options.code.redirect_url": redirectUrl,
          "options.access_token.redirect_url": redirectUrl
        }
      }
    );
  }

  async exhangeCodeForAccesToken(id: string, code: string) {
    const oauth = (await this.strategyService.findOne({_id: new ObjectId(id)})) as OAuthStrategy;
    oauth.options.access_token.params = oauth.options.access_token.params
      ? {...oauth.options.access_token.params, code}
      : {code};
    return this.sendRequest(oauth.options.access_token);
  }

  sendRequest(requestDetails: OAuthRequestDetails): Promise<any> {
    return axios({
      url: requestDetails.base_url,
      params: requestDetails.params,
      method: requestDetails.method as any,
      headers: requestDetails.headers
    });
  }
}
