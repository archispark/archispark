export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) { super(message, 404); }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(message, 422); }
}

export class ForbiddenError extends AppError {
  constructor(message: string) { super(message, 403); }
}
