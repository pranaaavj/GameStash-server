import Genre from '../models/genre.model.js';
import { paginate } from '../utils/index.js';
import { genreSchema } from '../validations/admin.validations.js';
import { isValidObjectId } from 'mongoose';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from '../errors/index.js';

/*****************************************/
// Admin - Genre CRUD
/*****************************************/

/**
 * @route GET - admin/genres
 * @desc  Admin - Listing all genres
 * @access Private
 */
export const getAllGenres = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const queryOptions = {
    sort: { updatedAt: -1 },
  };

  const genres = await paginate(Genre, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'All Genres',
    data: {
      genres: genres.result,
      totalPages: genres.totalPages,
      currentPage: genres.currentPage,
    },
  });
};

/**
 * @route GET - admin/genres/:genreId
 * @desc  Admin - Getting one genre
 * @access Private
 */
export const getOneGenre = async (req, res) => {
  const genreId = req.params.genreId.trim();

  if (!genreId || !isValidObjectId(genreId)) {
    throw new BadRequestError('Invalid genre ID format.');
  }

  const genre = await Genre.findById(genreId);
  if (!genre) {
    throw new NotFoundError('No Genre found.');
  }

  res.status(200).json({
    success: true,
    message: 'Genre fetched successfully.',
    data: genre,
  });
};

/**
 * @route POST - admin/genres
 * @desc  Admin - Adding a genre
 * @access Private
 */
export const addGenre = async (req, res) => {
  const { name, description } = await genreSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const existingGenre = await Genre.findOne({ name });
  if (existingGenre) {
    throw new BadRequestError('Genre already exists.');
  }

  await Genre.create({ name, description });

  res.status(200).json({
    success: true,
    message: 'Genre added successfully',
    data: null,
  });
};

/**
 * @route PUT - admin/genres
 * @desc  Admin - Editing a genre
 * @access Private
 */
export const editGenre = async (req, res) => {
  const { genreId, name, description } = req.body;

  if (!genreId || !isValidObjectId(genreId.trim())) {
    throw new BadRequestError('Invalid genre ID format.');
  }

  const genre = await Genre.findById(genreId);
  if (!genre) {
    throw new NotFoundError('No Genre found.');
  }

  const genreExist = await Genre.find({ name });
  if (genreExist.length > 0 && !genreExist._id.equals(genreId)) {
    throw new ConflictError('Genre already exist');
  }

  genre.name = name || genre.name;
  genre.description = description || genre.description;

  await genre.save();

  res.status(200).json({
    success: true,
    message: 'Genre updated successfully.',
    data: genre,
  });
};

/**
 * @route PATCH - admin/genres
 * @desc  Admin - Toggling genre listing
 * @access Private
 */
export const toggleGenreList = async (req, res) => {
  const { genreId } = req.body;

  if (!genreId || !isValidObjectId(genreId)) {
    throw new BadRequestError('Invalid genre ID format.');
  }

  const genre = await Genre.findById(genreId);
  if (!genre) {
    throw new NotFoundError('No Genre found');
  }

  genre.isActive = !genre.isActive;
  await genre.save();

  res.status(200).json({
    success: true,
    message: `Genre ${
      genre.isActive ? 'activated' : 'deactivated'
    } successfully.`,
    data: genre,
  });
};

/*****************************************/
// User - Genres
/*****************************************/

/**
 * @route GET - user/genres
 * @desc  User - Get all brands
 * @access Private
 */
export const getGenresUser = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const queryOptions = {
    filter: { isActive: true },
    sort: { updatedAt: -1 },
    select: '_id name',
  };

  const genres = await paginate(Genre, page, limit, queryOptions);

  if (genres?.result?.length === 0) {
    throw new NotFoundError('No genres found');
  }

  res.status(200).json({
    success: true,
    message: 'All Genres',
    data: {
      genres: genres.result,
      totalPages: genres.totalPages,
      currentPage: genres.currentPage,
    },
  });
};
