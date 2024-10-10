import { StatusCodes } from 'http-status-codes';
import { CustomAPIError } from './customAPI.error.js';

export class BadGatewayError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.BAD_GATEWAY;
  }
}
