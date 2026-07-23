/**
 * Erro de negócio (doc 04 §6): sempre com código estável em inglês
 * ("ERR_...") como message — o frontend traduz — e status HTTP adequado.
 */
class AppError {
  public readonly message: string;

  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    this.message = message;
    this.statusCode = statusCode;
  }
}

export default AppError;
