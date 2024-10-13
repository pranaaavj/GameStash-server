/**
 * @route auth/sign-up
 * @desc  User Sign up
 * @access Public
 */
export const homePage = (req, res) => {
  res.json({
    success: true,
    message: 'Hello',
    data: null,
  });
};
