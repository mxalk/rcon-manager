interface BootstrapPasswordState {
  userId: string;
  token: string;
}

let bootstrapState: BootstrapPasswordState | null = null;

export function setBootstrapPasswordState(userId: string, token: string): void {
  bootstrapState = { userId, token };
}

export function clearBootstrapPasswordStateForUser(userId: string): void {
  if (!bootstrapState) {
    return;
  }

  if (bootstrapState.userId === userId) {
    bootstrapState = null;
  }
}
