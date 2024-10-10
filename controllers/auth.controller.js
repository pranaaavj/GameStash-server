import { ConflictError } from '../errors/index.error.js';
/**
 * @route
 * @desc
 * @access
 */
export const first = async (req, res) => {
  throw new ConflictError('conflict');
  res.send('hello');
};
