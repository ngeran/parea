// Errors with stable machine codes. The client maps codes to localized,
// senior-friendly strings — server messages are for developers.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
