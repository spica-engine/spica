import {Controller, Get, INestApplication, ModuleMetadata, Req, Res} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {REQUEST_SERVICE} from "@spica-server/passport/src/options";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

import jsQR from "jsqr";
import {PNG} from "pngjs";
import speakeasy from "speakeasy";
import {parse} from "url";
import samlp from "samlp";

const EXPIRES_IN = 60_000;

const TOTP_TIMEOUT = 1000 * 30;

const CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDVjCCAj4CCQCIeeA38VX/wjANBgkqhkiG9w0BAQUFADBtMQswCQYDVQQGEwJU
UjEMMAoGA1UECAwDYXNkMQwwCgYDVQQHDANxd2UxDjAMBgNVBAoMBXZjYmNiMQ0w
CwYDVQQLDARxcmVmMQwwCgYDVQQDDANjZ2IxFTATBgkqhkiG9w0BCQEWBnNhZGFz
ZDAeFw0yMTA4MTAxNTE1NDVaFw0yMjA4MTAxNTE1NDVaMG0xCzAJBgNVBAYTAlRS
MQwwCgYDVQQIDANhc2QxDDAKBgNVBAcMA3F3ZTEOMAwGA1UECgwFdmNiY2IxDTAL
BgNVBAsMBHFyZWYxDDAKBgNVBAMMA2NnYjEVMBMGCSqGSIb3DQEJARYGc2FkYXNk
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0jtjuwHvz0f2f1EMAeK2
q0Bs6eU/9WyogDXyelokjEB8t2/cbSI9Ejapn86+YagabMYsVYmfyCiWuD2sv114
UuKc27EDgiOYZ1sSuur0At4ujjQTjr3SDeM8HmkKUPIt/2o7ausVm2GnEIWnriFq
u939U+rjNa691pt6WwnfbWDaf42z07Cqsultj33+xP+f8bYwrZMvl4tWiH5c7CET
gC6Mk0XY3Qd5dCV2/kRGTONzEubtY0HfzqjGGaXKNinYTCpt2q2gJ34YJAtlWvpF
tXSQccyAVezzFLDWNXcYPMzeay1msvHa6Gy00vj5qMVpxr8wCAMebyEsYJ9hQvaR
9wIDAQABMA0GCSqGSIb3DQEBBQUAA4IBAQAObg/Ym59lWGuwomPUGjZx2nGtq9v1
8iK5eKDfhKDoMzZwrAwwmqOcy0yOPwVZPOMWO+u1XCs/NbP2BJm9Zrw5o8PQaq+q
onTtBEnEC3WN9YAZyFJIrn4vuC0H38bUO2Se07XXAu/Vt0GEZeSvu5yqs7IpHUsa
Hl0f4vg2d/35D9k0d2kGzVVfRNIXizkpkBkaHIy0Ewbnp72nVibJ1sCtpgG9pa3P
pIoqfJjCfF/ng+is6RY0LdvRAKr45Mq3BFmKCKJtTCeaEtB9axU9GY9D7I5ze8DU
JzFg3mfrtUNpzlvK1PsYI7qEmMA5OMSlrciyzqUTbrSOvG1TZdsncIBQ
-----END CERTIFICATE-----`;

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDSO2O7Ae/PR/Z/
UQwB4rarQGzp5T/1bKiANfJ6WiSMQHy3b9xtIj0SNqmfzr5hqBpsxixViZ/IKJa4
Pay/XXhS4pzbsQOCI5hnWxK66vQC3i6ONBOOvdIN4zweaQpQ8i3/ajtq6xWbYacQ
haeuIWq73f1T6uM1rr3Wm3pbCd9tYNp/jbPTsKqy6W2Pff7E/5/xtjCtky+Xi1aI
flzsIROALoyTRdjdB3l0JXb+REZM43MS5u1jQd/OqMYZpco2KdhMKm3araAnfhgk
C2Va+kW1dJBxzIBV7PMUsNY1dxg8zN5rLWay8drobLTS+PmoxWnGvzAIAx5vISxg
n2FC9pH3AgMBAAECggEBAJ+2NqHPatvSE9XNQI3+KkAXhaZ7XweYMLqWQUvqR3G1
XAoPlSnjpPm9RUf+zGtsRgb01qF1GEn7a+U0FZSb8dkmB3xvEfdAC3wZmDUgYZf8
KuolbeY3FukuBHIl4ox0L7WmgtVLGvMcUMsgfq6u/GMU1mt2On6B7f6nx2B6M57n
YRjlBROQqSFT1LMCgn43QPHBuboxscRSV9s0OT741bjCa53gcSBQ0qipX+Z7TePK
PyCtdg21Oc71L6D168pHxndHmyaPpBhEOljUCWyVHooDAOedQDeSijtyPF2zmj2H
81IujMR3L9jJA1vA7RAJiIrRjXuwhh65RrE8fptiVMECgYEA6UG7pkJmMNkYWxFX
5i9q/B8apm2zND+0bNQuSk1Xg4UJloF7XTP4w3N5bckkhnHWcc+y1HJOoXtxr0OG
mLLAoO695QtpVHqGi3A1asSCTyyoDxypHCq5CKJW9SlBB/r1VqRbdQkMC+1JAOup
jgEmGupLUvAtYz3VKBJ+boYey88CgYEA5rrwxTBEOFBCHqdpIyw0sr/Q5N54vBFq
tTq9WA8tKnP/HZkfc4hN8JdJFZGze1SU6yiGWioB3oWmsbJJKs6wb8kfrs6DEtlU
K75FkJ9R6w/1Zfw8VxVy9zAp1cb2KVfmNgLTWRSkR6DdlqHqPwogOGZi1RtM6Kun
g1X9U5wdmVkCgYEAr9VQWl11YV9Vv9iMFUYrdNERquHJFBrtrJgqKPKyhL814hHL
aA/0d4nFwJ++++Y2jGbQXNuqMIq4wTC69sLQ+L/fwBhhF0Chyd0VN13ZCUwViAbH
6CbAgyS1PmwRzK0+YkjVdJ0USq1duebsUtLE4cc6btQEsun6lBGU40YRUvsCgYBY
u8Qk0a8qyRLknxV8BWAu7j30Bur/yOL016ZB23RPQ1T1mRHTaLQwtr3QobwYziqH
VYp12nnljhjRdfNVly+bjgm1PI6EDTilqgMu31atw/FoS10ZUJJqJgeww1egBsHu
O5/0Pk//jAosCBECNW62wgl4U4t8X6eIhuVp5jwr4QKBgF7bSVCicw+YcT2RVTX8
L8zbxHMyoqGgYWRxwfMS7J526C/frNi7NhVtfCUnfzVSSAPXEKChmRKzbVHlr7Fd
1I0kOXRZvFN9h/5W6RCmN/UhynDkmUEdSbbjAajRlDuLK7/UYUzvsPoppQaUbD1+
vwjkmUIrTPIh/PepTqXqV4F8
-----END PRIVATE KEY-----`;

enum ClaimNamespaces {
  nameIdentifier = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  email = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  name = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  givenname = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
  surname = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
  upn = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
  groups = "http://schemas.xmlsoap.org/claims/Group"
}

@Controller("idp")
export class SAMLController {
  constructor() {}

  @Get("login")
  async login(@Req() req, @Res() res) {
    req.query["SAMLRequest"] = decodeURIComponent(req.query["SAMLRequest"]);

    const authorization = req.headers["authorization"] || "";

    req.user = {
      identifier: authorization
    };

    const claims = this.getClaims(req.user);

    // SAMLP only conforms with express like response objects.
    res.set = (k, v) => {
      res.header(k, v);
    };

    samlp.auth({
      issuer: "spica",
      sessionIndex: -1,
      profileMapper: () => {
        return {
          getClaims: () => claims,
          getNameIdentifier: () => this.getNameIdentifier(claims)
        };
      },
      cert: CERTIFICATE,
      key: PRIVATE_KEY,
      getPostURL: function (wtrealm, wreply, req, callback) {
        const authnRequest = wreply.getElementsByTagName("AuthnRequest")[0];
        const callbackUrl = authnRequest?.getAttribute("AssertionConsumerServiceURL");

        return callback(null, callbackUrl);
      },
      // actual implementation sends template to the user and redirects user to the spica home page as logged in
      // But we will return saml response and send the response to the strategy complete endpoint to complete the SSO flow.
      responseHandler: function (response, opts, req, res, next) {
        res.send({url: opts.postUrl, SAMLResponse: response.toString("base64")});
      }
    })(req, res, () => {});
  }

  getClaims(user) {
    return {
      [ClaimNamespaces.upn]: user.identifier,
      [ClaimNamespaces.nameIdentifier]: user.identifier,
      [ClaimNamespaces.email]: user.identifier,
      [ClaimNamespaces.name]: user.identifier,
      [ClaimNamespaces.givenname]: user.identifier,
      [ClaimNamespaces.surname]: user.identifier
    };
  }

  getNameIdentifier(claims) {
    return {
      nameIdentifier:
        claims[ClaimNamespaces.nameIdentifier] ||
        claims[ClaimNamespaces.name] ||
        claims[ClaimNamespaces.email]
    };
  }
}

@Controller("oauth")
export class OAuthController {
  @Get("code")
  code() {
    return "super_secret_code";
  }

  @Get("token")
  token() {
    return {access_token: "super_secret_token"};
  }

  @Get("info")
  info() {
    return {
      email: "testuser@testuser.com",
      picture: "url"
    };
  }
}

export class RequestService {
  public service: Request;
  public publicUrl: string;

  request(options: any) {
    options.url = options.url.replace(this.publicUrl, "");
    return this.service.request({path: options.url, ...options}).then(res => res.body);
  }
}

describe("E2E Tests", () => {
  const publicUrl = "http://insteadof";
  const moduleMetaData: ModuleMetadata = {
    controllers: [SAMLController, OAuthController],
    imports: [
      SchemaModule.forRoot(),
      DatabaseTestingModule.standalone(),
      PassportModule.forRoot({
        expiresIn: EXPIRES_IN,
        issuer: "spica",
        maxExpiresIn: EXPIRES_IN,
        publicUrl: publicUrl,
        samlCertificateTTL: EXPIRES_IN,
        secretOrKey: "spica",
        defaultStrategy: "IDENTITY",
        defaultIdentityIdentifier: "spica",
        defaultIdentityPassword: "spica",
        audience: "spica",
        defaultIdentityPolicies: ["PassportFullAccess"]
      }),
      PreferenceTestingModule,
      CoreTestingModule
    ]
  };

  let req: Request;
  let app: INestApplication;
  let token: string;

  async function login(identifier?: string, password?: string) {
    const {body} = await req.post("/passport/identify", {
      identifier: identifier || "spica",
      password: password || "spica"
    });

    token = body.token;
  }

  describe("JWT", () => {
    beforeEach(async () => {
      const module = await Test.createTestingModule(moduleMetaData).compile();

      req = module.get(Request);
      app = module.createNestApplication();

      await app.listen(req.socket);

      // WAIT UNTIL IDENTITY IS INSERTED
      await new Promise((resolve, _) => setTimeout(resolve, 3000));

      await login();
    });

    const getIdentities = () => {
      return req.get(
        "/passport/identity",
        {},
        {
          Authorization: `IDENTITY ${token}`
        }
      );
    };

    it("should list identities", async () => {
      const {body: identities} = await getIdentities();

      expect(identities.length).toBe(1);
    });

    it("should not list identities if jwt is out of date", async () => {
      const {body: identities} = await getIdentities();
      expect(identities.length).toBe(1);

      const identityId = identities[0]._id;
      await req.put(
        `/passport/identity/${identityId}`,
        {identifier: "spica", password: "spica2"},
        {Authorization: `IDENTITY ${token}`}
      );

      const {body: error} = await getIdentities();
      expect(error).toEqual({message: "Invalid JWT", error: "Bad Request", statusCode: 400});

      // WAIT BEFORE CREATE NEW JWT
      await new Promise((resolve, _) => setTimeout(resolve, 1000));

      await login("spica", "spica2");

      const {body: updatedIdentities} = await getIdentities();
      expect(updatedIdentities.length).toBe(1);
    });
  });

  describe("SSO", () => {
    describe("SAML", () => {
      beforeEach(async () => {
        const module = await Test.createTestingModule(moduleMetaData).compile();

        req = module.get(Request);
        app = module.createNestApplication();

        await app.listen(req.socket);

        // WAIT UNTIL IDENTITY IS INSERTED
        await new Promise((resolve, _) => setTimeout(resolve, 3000));

        await login();

        // STRATEGY INSERT
        const strategy = {
          type: "saml",
          name: "strategy1",
          title: "strategy1",
          options: {
            ip: {
              login_url: "/idp/login",
              logout_url: "/idp/logout",
              certificate: CERTIFICATE
            }
          }
        };
        await req.post("/passport/strategy", strategy, {Authorization: `IDENTITY ${token}`});
      });

      it("should list strategies with public properties", async () => {
        const {body: strategies} = await req.get("/passport/strategies");
        expect(strategies).toEqual([
          {
            _id: strategies[0]._id,
            type: "saml",
            name: "strategy1",
            title: "strategy1",
            icon: "login"
          }
        ]);
      });

      it("should list strategies with private properties", async () => {
        const {body: strategies} = await req.get(
          "/passport/strategy",
          {},
          {
            Authorization: `IDENTITY ${token}`
          }
        );

        const sp = strategies[0].options.sp;
        delete strategies[0].options.sp;

        expect(strategies).toEqual([
          {
            _id: strategies[0]._id,
            type: "saml",
            name: "strategy1",
            title: "strategy1",
            icon: "login",
            options: {
              ip: {
                login_url: "/idp/login",
                logout_url: "/idp/logout",
                certificate: CERTIFICATE
              }
            }
          }
        ]);
        expect(sp.certificate).toBeDefined();
        expect(sp.private_key).toBeDefined();
      });

      it("should update strategy", async () => {
        const {body: strategies} = await req.get(
          "/passport/strategy",
          {},
          {
            Authorization: `IDENTITY ${token}`
          }
        );

        const id = strategies[0]._id;
        delete strategies[0]._id;

        strategies[0].title = "new strategy title";

        const {body: updatedStrategy} = await req.put(`/passport/strategy/${id}`, strategies[0], {
          Authorization: `IDENTITY ${token}`
        });

        expect(updatedStrategy).toEqual({...strategies[0], _id: id});
      });

      it("should get strategy login url", async () => {
        const {body: strategies} = await req.get("/passport/strategies");
        const {body: strategy} = await req.get(`/passport/strategy/${strategies[0]._id}/url`);

        expect(strategy.state).toBeDefined();
        expect(strategy.url.startsWith("/idp/login?SAMLRequest=")).toBe(true);
      });

      it("should complete SSO with success", done => {
        req.get("/passport/strategies").then(({body: strategies}) => {
          req.get(`/passport/strategy/${strategies[0]._id}/url`).then(({body: strategy}) => {
            req.get("/passport/identify", {state: strategy.state}).then(async res => {
              expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
              expect(res.body.scheme).toEqual("IDENTITY");
              expect(res.body.issuer).toEqual("passport/identity");
              expect(res.body.token).toBeDefined();

              // make sure token is valid
              const {
                body: {identifier}
              } = await req.get("/passport/identity/verify", {}, {authorization: res.body.token});
              expect(identifier).toEqual("testuser");
              done();
            });

            const {url: strategyUrl, params: strategyParams} = parseUrl(strategy.url, publicUrl);
            req
              .get(strategyUrl, strategyParams, {authorization: "testuser"})
              .then(({body: {SAMLResponse, url: completeUrl}}) => {
                // this last request because of we use test environment,
                // actual SSO implementation handles this last step automatically on browser environment and redirects user to the panel as logged in
                const request = parseUrl(completeUrl, publicUrl);
                req
                  .post(request.url, {SAMLResponse: SAMLResponse}, {}, request.params)
                  .then(res => {
                    expect([res.statusCode, res.statusText]).toEqual([204, "No Content"]);
                    expect(res.body).toBeUndefined();
                  });
              });
          });
        });
      });
    });

    describe("OAuth", () => {
      const strategy = {
        type: "oauth",
        name: "oauth",
        title: "oauth",
        icon: "login",
        options: {
          idp: "custom",
          code: {
            base_url: publicUrl + "/oauth/code",
            params: {
              client_id: "client_id"
            },
            headers: {},
            method: "get"
          },
          access_token: {
            base_url: publicUrl + "/oauth/token",
            params: {
              client_id: "client_id",
              client_secret: "client_secret"
            },
            headers: {},
            method: "get"
          },
          identifier: {
            base_url: publicUrl + "/oauth/info",
            params: {},
            headers: {},
            method: "get"
          }
        }
      };

      beforeEach(async () => {
        const module = await Test.createTestingModule(moduleMetaData)
          .overrideProvider(REQUEST_SERVICE)
          .useClass(RequestService)
          .compile();

        req = module.get(Request);
        app = module.createNestApplication();

        // set request service as it sends requests via unix socket
        const requestService: RequestService = module.get(REQUEST_SERVICE);
        requestService.service = req;
        requestService.publicUrl = publicUrl;

        await app.listen(req.socket);

        // WAIT UNTIL IDENTITY IS INSERTED
        await new Promise((resolve, _) => setTimeout(resolve, 3000));

        await login();

        // STRATEGY INSERT
        await req.post("/passport/strategy", strategy, {Authorization: `IDENTITY ${token}`});
      });

      it("should list strategies", async () => {
        const {body: strategies} = await req.get("/passport/strategies");
        expect(strategies).toEqual([
          {
            _id: strategies[0]._id,
            type: "oauth",
            name: "oauth",
            title: "oauth",
            icon: "login"
          }
        ]);
      });

      it("should get strategy login url", async () => {
        const {body: strategies} = await req.get("/passport/strategies");
        const {body: strategy} = await req.get(`/passport/strategy/${strategies[0]._id}/url`);

        expect(strategy.state).toBeDefined();
        expect(
          strategy.url.startsWith(
            `${publicUrl}/oauth/code?client_id=client_id&redirect_uri=${publicUrl}/passport/strategy/${strategies[0]._id}/complete&state=`
          )
        ).toBe(true);
      });

      it("should complete SSO with success", done => {
        req.get("/passport/strategies").then(({body: strategies}) => {
          req.get(`/passport/strategy/${strategies[0]._id}/url`).then(({body: strategy}) => {
            const _ = req.get("/passport/identify", {state: strategy.state}).then(async res => {
              expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
              expect(res.body.scheme).toEqual("IDENTITY");
              expect(res.body.issuer).toEqual("passport/identity");
              expect(res.body.token).toBeDefined();

              // make sure token is valid
              const {body} = await req.get(
                "/passport/identity/verify",
                {},
                {authorization: res.body.token}
              );
              expect(body.identifier).toEqual("testuser@testuser.com");
              expect(body.attributes).toEqual({
                email: "testuser@testuser.com",
                picture: "url"
              });
              done();
            });

            // we should get code and send it to the compelete endpoint manually, there is no such a step in real scenario

            // get code
            const {url: strategyUrl, params: strategyParams} = parseUrl(strategy.url, publicUrl);
            req
              .get(strategyUrl, strategyParams, {
                authorization: "testuser"
              })
              .then(({body: code}) => {
                // send code to the strategy complete endpoint
                const {url: completeUrl, params: completeParams} = parseUrl(
                  strategyParams.redirect_uri,
                  publicUrl
                );
                req
                  .get(completeUrl, {
                    ...completeParams,
                    code: code,
                    state: strategyParams.state
                  })
                  .then(res => {
                    expect([res.statusCode, res.statusText]).toEqual([204, "No Content"]);
                    expect(res.body).toBeUndefined();
                  });
              });
          });
        });
      });
    });
  });

  describe("2FA", () => {
    let identity;

    beforeEach(async () => {
      const module = await Test.createTestingModule(moduleMetaData).compile();

      req = module.get(Request);
      app = module.createNestApplication();

      await app.listen(req.socket);

      // WAIT UNTIL IDENTITY IS INSERTED
      await new Promise((resolve, _) => setTimeout(resolve, 3000));

      await login();
    });

    describe("Activating 2fa", () => {
      beforeEach(async () => {
        identity = await req
          .post(
            "/passport/identity",
            {identifier: "identityWith2fa", password: "password"},
            {Authorization: `IDENTITY ${token}`}
          )
          .then(r => r.body);
      });

      async function startVerification(identity) {
        const totpSchema = await req
          .get(
            `/passport/identity/factors`,
            {},
            {
              Authorization: `IDENTITY ${token}`
            }
          )
          .then(r => r.body.find(f => f.type == "totp"));

        return req
          .post(`/passport/identity/${identity._id}/start-factor-verification`, totpSchema, {
            Authorization: `IDENTITY ${token}`
          })
          .then(r => r.body as {challenge: string; answerUrl: string});
      }

      function completeVerification(totp: string, answerUrl: string) {
        return req.post(answerUrl, {answer: totp}, {Authorization: `IDENTITY ${token}`});
      }

      describe("TOTP", () => {
        afterEach(() => {
          jest.useRealTimers();
        });

        it("should activate 2fa", async () => {
          const {answerUrl, challenge} = await startVerification(identity);
          const totp = generateTotp(challenge);
          const res = await completeVerification(totp, answerUrl);

          expect(res.statusCode).toEqual(201);
          expect(res.body).toEqual({message: "Verification has been completed successfully."});
        });

        it("should not activate 2fa if verification is failed", async () => {
          const {answerUrl} = await startVerification(identity);
          // this totp might be generated, use something worse
          const wrongTotp = "000000";
          const res = await completeVerification(wrongTotp, answerUrl);

          expect(res.statusCode).toEqual(401);
          expect(res.body.message).toEqual("Verification has been failed.");
        });

        async function activate2fa(identity) {
          const {answerUrl, challenge} = await startVerification(identity);
          let totp = generateTotp(challenge);
          await completeVerification(totp, answerUrl);
          return challenge;
        }

        it("should login if 2fa code is correct", async () => {
          const challenge = await activate2fa(identity);

          let res = await req.post("/passport/identify", {
            identifier: "identityWith2fa",
            password: "password"
          });
          expect(res.body).toEqual({
            challenge: "Please enter the 6 digit code",
            answerUrl: `passport/identify/${identity._id}/factor-authentication`
          });

          const totp = generateTotp(challenge);

          res = await req.post(res.body.answerUrl, {answer: totp});
          expect(res.statusCode).toEqual(201);
          expect(res.body.token).toBeDefined();
        });

        it("should not login if 2fa code is incorrect", async () => {
          await activate2fa(identity);

          let res = await req.post("/passport/identify", {
            identifier: "identityWith2fa",
            password: "password"
          });

          const totp = "000000";

          res = await req.post(res.body.answerUrl, {answer: totp});
          expect(res.body).toEqual({
            statusCode: 401,
            message: "Unauthorized"
          });
        });

        it("should deactivate 2fa", async () => {
          await activate2fa(identity);

          await req.delete(
            `/passport/identity/${identity._id}/factors`,
            {},
            {Authorization: `IDENTITY ${token}`}
          );

          const res = await req.post("/passport/identify", {
            identifier: "identityWith2fa",
            password: "password"
          });

          expect(res.statusCode).toEqual(200);
          expect(res.body.token).toBeDefined();
        });

        it("should throw error if complete factor verification is called before started", async () => {
          const res = await completeVerification(
            "000000",
            `/passport/identity/${identity._id}/complete-factor-verification`
          );

          expect(res.statusCode).toEqual(400);
          expect(res.body.message).toEqual("Start a factor verification before complete it.");
        });

        it("should throw error if factor verification completed after totp is expired", async () => {
          const {answerUrl, challenge} = await startVerification(identity);
          const totp = generateTotp(challenge);

          const thirtySecondsLater = new Date(Date.now() + TOTP_TIMEOUT);
          jest.useFakeTimers({doNotFake: ["nextTick"]}); // passport.authenticate() depends on it
          jest.setSystemTime(thirtySecondsLater);

          const res = await completeVerification(totp, answerUrl);
          expect(res.statusCode).toEqual(401);
          expect(res.body.message).toEqual("Verification has been failed.");
        });

        it("should throw error if factor authentication completed totp is expired", async () => {
          const challenge = await activate2fa(identity);

          let res = await req.post("/passport/identify", {
            identifier: "identityWith2fa",
            password: "password"
          });

          const totp = generateTotp(challenge);

          const afterServerTimeouted = new Date(Date.now() + TOTP_TIMEOUT + 1);
          jest.useFakeTimers();
          jest.setSystemTime(afterServerTimeouted);

          res = await req.post(res.body.answerUrl, {answer: totp});
          expect(res.statusCode).toEqual(401);
          expect(res.body.message).toEqual("Unauthorized");
        });
      });
    });
  });
});

function generateTotp(challenge: string) {
  // convert base64 image to png, read secret from png, generate otp from secret
  const buff = Buffer.from(challenge.replace("data:image/png;base64,", ""), "base64");

  const png = PNG.sync.read(buff);

  const code = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);
  const secret = parse(code.data, true).query.secret;

  return speakeasy.totp({
    secret: secret,
    encoding: "base32"
  });
}

function parseUrl(url: string, remove?: string) {
  let params: any = {};

  if (remove) {
    url = url.replace(remove, "");
  }

  url
    .substring(url.indexOf("?") + 1)
    .split("&")
    .forEach(param => {
      const arr = param.split("=");
      params[arr[0]] = arr[1];
    });

  url = url.substring(0, url.includes("?") ? url.indexOf("?") : url.length);

  return {url, params};
}
