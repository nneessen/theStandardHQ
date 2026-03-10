export class UnderwritingRequestError extends Error {
  constructor(
    message: string,
    public code: string | null,
    public status: number | null,
    public requestId: string | null = null,
  ) {
    super(message);
    this.name = "UnderwritingRequestError";
  }
}

type RequestErrorPayload = {
  code?: string;
  error?: string;
  requestId?: string;
};

type EdgeFunctionInvokeError = Error & {
  context?: Response;
};

export async function extractUnderwritingRequestError(
  error: EdgeFunctionInvokeError,
  fallbackMessage: string,
): Promise<UnderwritingRequestError> {
  const status: number | null = error.context?.status ?? null;
  let message = error.message || fallbackMessage;
  let code: string | null = null;
  let requestId: string | null = null;

  try {
    const body = error.context
      ? ((await error.context.json()) as RequestErrorPayload)
      : null;

    if (body?.error) {
      message = body.error;
    }

    code = body?.code ?? null;
    requestId = body?.requestId ?? null;
  } catch {
    // Fall back to the transport error message when the response body is absent.
  }

  return new UnderwritingRequestError(message, code, status, requestId);
}

export function createUnderwritingRequestError(
  payload: RequestErrorPayload | null | undefined,
  fallbackMessage: string,
  status: number | null = null,
): UnderwritingRequestError {
  return new UnderwritingRequestError(
    payload?.error || fallbackMessage,
    payload?.code ?? null,
    status,
    payload?.requestId ?? null,
  );
}

export function formatUnderwritingRequestErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof UnderwritingRequestError) {
    return error.requestId
      ? `${error.message} Request ID: ${error.requestId}`
      : error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
