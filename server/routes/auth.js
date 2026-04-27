const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await db('users').where({ email: email.toLowerCase().trim() }).first();
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const wings = await db('wing_access_grants')
      .join('business_wings', 'business_wings.id', 'wing_access_grants.business_wing_id')
      .where('wing_access_grants.user_id', user.id)
      .where('business_wings.is_active', true)
      .select('business_wings.id', 'business_wings.name', 'business_wings.code');

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role }, wings });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).select('id','name','email','role','is_active').first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const wings = await db('wing_access_grants')
      .join('business_wings', 'business_wings.id', 'wing_access_grants.business_wing_id')
      .where('wing_access_grants.user_id', user.id)
      .where('business_wings.is_active', true)
      .select('business_wings.id', 'business_wings.name', 'business_wings.code');

    res.json({ ...user, wings });
  } catch (err) {
    console.error('me error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await db('users').where({ id: req.user.id }).first();
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await db('users').where({ id: req.user.id }).update({ password_hash: hash, updated_at: new Date() });
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('change-password error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
