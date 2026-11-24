// In-memory only. Never persist this token or send it to a third-party provider.
let token: string | null = null;

export function setProviderAccessToken(value: string | null) { token = value; }
export function getProviderAccessToken() { return token; }
