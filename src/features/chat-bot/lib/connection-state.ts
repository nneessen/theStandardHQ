export type ConnectionVisualState =
  | "connected"
  | "disconnected"
  | "unavailable";

export function resolveConnectionState({
  connected,
  error,
}: {
  connected?: boolean | null;
  error?: unknown;
}): ConnectionVisualState {
  if (
    error &&
    typeof error === "object" &&
    "isServiceError" in error &&
    (error as { isServiceError?: boolean }).isServiceError === true
  ) {
    return "unavailable";
  }

  return connected === true ? "connected" : "disconnected";
}

export function getConnectionStateLabel(
  state: ConnectionVisualState,
  labels: {
    connected: string;
    disconnected: string;
    unavailable: string;
  },
): string {
  return labels[state];
}
