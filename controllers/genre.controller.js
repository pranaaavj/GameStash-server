import { paginate } from '../utils/index.js';
import { NotFoundError } from '../errors/index.js';
import Genre from '../models/genre.model.js';

/**
 * @route GET - admin/genres
 * @desc  Admin - Listing all genres
 * @access Private
 */
export const getGenres = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const genre = await paginate(Genre, page, limit);

  if (genre?.result?.length === 0) {
    throw new NotFoundError('No genre found');
  }

  res.status(200).json({
    success: true,
    message: 'All Genres',
    data: {
      genres: genre.result,
      totalPages: genre.totalPages,
      currentPage: genre.currentPage,
    },
  });
};
