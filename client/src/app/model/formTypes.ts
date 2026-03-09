import type { AccountRole } from "../../lib/types.js";

export interface ServerFormState {
  id: string;
  name: string;
  host: string;
  port: string;
  password: string;
}

export interface UserFormState {
  username: string;
  password: string;
  role: AccountRole;
}
