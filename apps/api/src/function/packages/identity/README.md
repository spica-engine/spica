# @spica-devkit/identity

Identity package for Spica. Provides programmatic access to identity management, authentication, policy operations, factor management, and strategy-based login for Spica-based applications.

## Features

- Initialization (`initialize`)
- Token verification (`verifyToken`)
- Login with password or challenge (`login`)
- Login with external strategy (`loginWithStrategy`)
- List authentication strategies (`getStrategies`)
- CRUD operations for identities (`getAll`, `get`, `insert`, `update`, `remove`, `removeMany`)
- Policy management (`policy.attach`, `policy.detach`)
- Authentication factor management (`authfactor.list`, `authfactor.register`, `authfactor.unregister`)
- Type guards (`isChallenge`)

## Installation

```bash
npm install @spica-devkit/identity
```

## Usage

### Initialization

```typescript
import * as Identity from "@spica-devkit/identity";

Identity.initialize({apikey: "YOUR_API_KEY", publicUrl: "http://localhost:3000"});
// or
Identity.initialize({identity: "IDENTITY_TOKEN", publicUrl: "http://localhost:3000"});
```

### verifyToken

```typescript
const decoded = await Identity.verifyToken(token);
// Optionally, you can specify a baseUrl and headers
// const decoded = await Identity.verifyToken(token, "http://localhost:3000", {CustomHeader: "value"});
```

### login

```typescript
// Returns a token (string) or a Challenge object (for 2FA)
const tokenOrChallenge = await Identity.login("username", "password");
// With token lifespan (in seconds)
const token = await Identity.login("username", "password", 3600);
// With custom headers
const token = await Identity.login("username", "password", undefined, {Accept: "application/json"});
```

### isChallenge

```typescript
if (Identity.isChallenge(tokenOrChallenge)) {
  // Handle challenge
  const challengeText = tokenOrChallenge.show();
  const token = await tokenOrChallenge.answer("challenge-response");
}
```

### loginWithStrategy

```typescript
const {url, token} = await Identity.loginWithStrategy("strategy_id");
// Redirect user to `url`, then subscribe to `token` observable for result
token.subscribe({
  next: result => {
    if (Identity.isChallenge(result)) {
      // Handle challenge
    } else {
      // Got token
    }
  }
});
```

### getStrategies

```typescript
const strategies = await Identity.getStrategies();
// With headers
// const strategies = await Identity.getStrategies({Accept: "application/json"});
```

### getAll

```typescript
const identities = await Identity.getAll();
// With query params
const paged = await Identity.getAll({
  paginate: true,
  limit: 10,
  skip: 0,
  filter: {identifier: "user"}
});
// With headers
const identities = await Identity.getAll({}, {Accept: "application/json"});
```

### get

```typescript
const identity = await Identity.get("identity_id");
// With headers
const identity = await Identity.get("identity_id", {Accept: "application/json"});
```

### insert

```typescript
const identity = await Identity.insert({
  identifier: "user1",
  password: "pass1",
  policies: ["SomePolicy"]
});
// With headers
const identity = await Identity.insert(
  {identifier: "user2", password: "pass2", policies: []},
  {Accept: "application/json"}
);
```

### update

```typescript
const updated = await Identity.update("identity_id", {
  password: "newpassword",
  policies: ["NewPolicy"]
});
// With headers
const updated = await Identity.update(
  "identity_id",
  {password: "pw"},
  {Accept: "application/json"}
);
```

### remove

```typescript
await Identity.remove("identity_id");
// With headers
await Identity.remove("identity_id", {Accept: "application/json"});
```

### removeMany

```typescript
const result = await Identity.removeMany(["id1", "id2"]);
// With headers
const result = await Identity.removeMany(["id1", "id2"], {Accept: "application/json"});
```

### policy.attach

```typescript
await Identity.policy.attach("identity_id", ["Policy1", "Policy2"]);
// With headers
await Identity.policy.attach("identity_id", ["Policy1"], {Accept: "application/json"});
```

### policy.detach

```typescript
await Identity.policy.detach("identity_id", ["Policy1"]);
// With headers
await Identity.policy.detach("identity_id", ["Policy1"], {Accept: "application/json"});
```

### authfactor.list

```typescript
const factors = await Identity.authfactor.list();
// With headers
const factors = await Identity.authfactor.list({Accept: "application/json"});
```

### authfactor.register

```typescript
const challenge = await Identity.authfactor.register("identity_id", {type: "totp", config: {}});
// With headers
const challenge = await Identity.authfactor.register(
  "identity_id",
  {type: "totp", config: {}},
  {Accept: "application/json"}
);
```

### authfactor.unregister

```typescript
await Identity.authfactor.unregister("identity_id");
// With headers
await Identity.authfactor.unregister("identity_id", {Accept: "application/json"});
```

## API Reference

See [src/interface.ts](./src/interface.ts) for detailed type definitions.

## License

AGPLv3
