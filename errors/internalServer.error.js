import { StatusCodes } from 'http-status-codes';
import { CustomAPIError } from './customAPI.error.js';

export class InternalServerError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  }
}
