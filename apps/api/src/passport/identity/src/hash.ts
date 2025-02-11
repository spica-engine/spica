import * as bcrypt from "bcryptjs";

export function hash(v: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    bcrypt.hash(v, 10, (error, hash) => {
      if (error) {
        return reject(error);
      }
      resolve(hash);
    });
  });
}

export function compare(candidatePassword: string, hashedPassword: string) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(candidatePassword, hashedPassword, (error, match) => {
      if (error) {
        return reject(error);
      }
      resolve(match);
    });
  });
}
