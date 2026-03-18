declare module "bcrypt" {
  export function hash(data: string, rounds: number): Promise<string>;
  export function compare(data: string, hash: string): Promise<boolean>;
}

declare module "argon2" {
  export function hash(data: string, options?: any): Promise<string>;
  export function verify(hash: string, data: string): Promise<boolean>;
  export const argon2i: number;
  export const argon2d: number;
  export const argon2id: number;
}
