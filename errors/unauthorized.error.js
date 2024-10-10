import { StatusCodes } from 'http-status-codes';
import { CustomAPIError } from './customAPI.error.js';

export class NotAuthorizedError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.UNAUTHORIZED;
  }
}
