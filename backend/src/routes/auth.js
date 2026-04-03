const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateMode,
  getProfile,
  updateProfile,
  verifyEmail,
  resendVerificationCode,
  searchUsers
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.get('/me', protect, getMe);
router.patch('/mode', protect, updateMode);
router.patch('/profile', protect, updateProfile);
router.get('/profile/:id', protect, getProfile);
router.get('/users/search', protect, searchUsers);

module.exports = router;
