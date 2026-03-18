export class CliodotApiError extends Error {
  readonly status?: number;
  readonly response?: any;
  readonly data?: any;

  constructor(message: string, options?: { status?: number; response?: any; data?: any }) {
    super(message);
    this.name = "CliodotApiError";
    this.status = options?.status;
    this.response = options?.response;
    this.data = options?.data ?? options?.response?.data;
  }
}
