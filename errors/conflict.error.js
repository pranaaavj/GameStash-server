import { StatusCodes } from 'http-status-codes';
import { CustomAPIError } from './customAPI.error.js';

export class ConflictError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.CONFLICT;
  }
}
