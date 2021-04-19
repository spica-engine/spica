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
    const redirectUri = `${this.options.publicUrl}/passport/strategy/${strategy._id}/redirect`;
    return this.strategyService.findOneAndUpdate(
      {
        _id: new ObjectId(strategy._id)
      },
      {
        $set: {
          "options.code.params.redirect_uri": redirectUri,
          "options.access_token.params.redirect_uri": redirectUri
        }
      }
    );
  }

  async getUserEmail(id: string, code: string) {
    const oauth = (await this.strategyService.findOne({_id: new ObjectId(id)})) as OAuthStrategy;

    if (!oauth) {
      throw Error("OAuth strategy does not exist.");
    }

    oauth.options.access_token.params = oauth.options.access_token.params
      ? {...oauth.options.access_token.params, code}
      : {code};
    const accessTokenRes = await this.sendRequest(oauth.options.access_token);

    if (!accessTokenRes.access_token) {
      throw Error("Access token could not find.");
    }

    oauth.options.identifier.params = oauth.options.identifier.params
      ? {...oauth.options.identifier.params, access_token: accessTokenRes.access_token}
      : {access_token: accessTokenRes.access_token};

    return this.sendRequest(oauth.options.identifier);
  }

  async getCodeRequest(id: string) {
    const strategy = await this.strategyService.findOne({_id: new ObjectId(id)});
    
    const url = strategy.options.code.base_url;

    const params = [];
    
    for (const [param, value] of Object.entries(strategy.options.code.params)) {
      params.push(`${param}=${value}`);
    }

    return `${url}?${params.join("&")}`;
  }

  sendRequest(requestDetails: OAuthRequestDetails): Promise<any> {
    return axios({
      url: requestDetails.base_url,
      params: requestDetails.params,
      method: requestDetails.method as any,
      headers: requestDetails.headers,
      responseType: "json"
    })
      .then(res => res.data)
      .catch(error => error.response.data);
  }
}
