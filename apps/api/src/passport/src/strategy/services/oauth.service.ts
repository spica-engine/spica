import {Inject, Injectable} from "@nestjs/common";
import {ObjectId, ReturnDocument} from "@spica-server/database";
import {OAuthRequestDetails, OAuthStrategy, Strategy, StrategyTypeService} from "../interface";
import {StrategyService} from "./strategy.service";
import {PassportOptions, PASSPORT_OPTIONS, RequestService, REQUEST_SERVICE} from "../../options";
import {v4 as uuidv4} from "uuid";

@Injectable()
export class OAuthService implements StrategyTypeService {
  readonly type = "oauth";

  constructor(
    private strategyService: StrategyService,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions,
    @Inject(REQUEST_SERVICE) private req: RequestService
  ) {}

  async assert(strategy: OAuthStrategy, body?: unknown, code?: string): Promise<any> {
    strategy.options.access_token.params = {
      ...(strategy.options.access_token.params || {}),
      code
    };

    const tokenResponse = await this.sendRequest(strategy.options.access_token);
    if (!tokenResponse.access_token) {
      throw Error("Access token could not find.");
    }

    strategy.options.identifier.params = {
      ...(strategy.options.identifier.params || {}),
      access_token: tokenResponse.access_token
    };

    // some services only accept token on Authorization header
    strategy.options.identifier.headers = {
      Authorization: `token ${tokenResponse.access_token}`
    };

    return this.sendRequest(strategy.options.identifier).then(user => {
      return {user};
    });
  }

  getLoginUrl(strategy: OAuthStrategy): {url: string; state: string} {
    let url = strategy.options.code.base_url;

    const params = [];

    for (const [param, value] of Object.entries(strategy.options.code.params)) {
      params.push(`${param}=${value}`);
    }

    const state = uuidv4();

    params.push(`state=${state}`);

    url = `${url}?${params.join("&")}`;

    return {url, state};
  }

  getStrategy(id: string): Promise<Strategy> {
    return this.strategyService.findOne({_id: new ObjectId(id)}) as Promise<OAuthStrategy>;
  }

  prepareToInsert(strategy: OAuthStrategy) {}

  afterInsert(strategy: OAuthStrategy): Promise<Strategy> {
    const redirectUri = `${this.options.publicUrl}/passport/strategy/${strategy._id}/complete`;
    return this.strategyService.findOneAndUpdate(
      {
        _id: new ObjectId(strategy._id)
      },
      {
        $set: {
          "options.code.params.redirect_uri": redirectUri,
          "options.access_token.params.redirect_uri": redirectUri
        }
      },
      {returnDocument: ReturnDocument.AFTER}
    );
  }

  sendRequest(requestDetails: OAuthRequestDetails): Promise<any> {
    return this.req.request({
      url: requestDetails.base_url,
      params: requestDetails.params,
      method: requestDetails.method as any,
      headers: requestDetails.headers,
      responseType: "json"
    });
  }
}
