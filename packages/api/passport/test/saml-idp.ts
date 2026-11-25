import {randomUUID} from "crypto";
import {inflateRawSync} from "zlib";
import {SignedXml} from "xml-crypto";

const CLAIMS = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims";

const EXCLUSIVE_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";

const VALIDITY_MS = 60_000;

export function parseAuthnRequest(samlRequest: string) {
  const xml = inflateRawSync(Buffer.from(samlRequest, "base64")).toString();
  return {
    issuer: xml.match(/<saml:Issuer[^>]*>([^<]+)</)[1],
    assertionConsumerServiceUrl: xml.match(/AssertionConsumerServiceURL="([^"]+)"/)[1]
  };
}

export function createSamlResponse(options: {
  identifier: string;
  audience: string;
  certificate: string;
  privateKey: string;
}) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + VALIDITY_MS).toISOString();

  const attributes = ["upn", "nameidentifier", "emailaddress", "name", "givenname", "surname"]
    .map(
      claim =>
        `<saml:Attribute Name="${CLAIMS}/${claim}"><saml:AttributeValue>${options.identifier}</saml:AttributeValue></saml:Attribute>`
    )
    .join("");

  const response =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${randomUUID()}" Version="2.0" IssueInstant="${now}">` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_${randomUUID()}" Version="2.0" IssueInstant="${now}">` +
    `<saml:Issuer>spica</saml:Issuer>` +
    `<saml:Subject><saml:NameID>${options.identifier}</saml:NameID></saml:Subject>` +
    `<saml:Conditions NotBefore="${now}" NotOnOrAfter="${expiresAt}"><saml:AudienceRestriction><saml:Audience>${options.audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${now}" SessionIndex="_${randomUUID()}"/>` +
    `<saml:AttributeStatement>${attributes}</saml:AttributeStatement>` +
    `</saml:Assertion>` +
    `</samlp:Response>`;

  const signature = new SignedXml({
    privateKey: options.privateKey,
    publicCert: options.certificate,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: EXCLUSIVE_C14N
  });
  signature.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", EXCLUSIVE_C14N],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256"
  });
  signature.computeSignature(response, {
    location: {
      reference: "//*[local-name(.)='Assertion']/*[local-name(.)='Issuer']",
      action: "after"
    }
  });

  return Buffer.from(signature.getSignedXml()).toString("base64");
}
