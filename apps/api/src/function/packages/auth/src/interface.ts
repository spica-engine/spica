interface User {
  _id: string;
  username: string;
  password: string;
  policies: string[];
  attributes?: object;
  lastLogin?: Date;
  failedAttempts?: Date[];
}

export type UserCreate = Omit<User, "_id" | "lastLogin" | "failedAttempts" | "policies">;
export type UserGet = Omit<User, "password">;
export type UserUpdate = Pick<User, "password">;

export type TokenScheme = {token: string};
