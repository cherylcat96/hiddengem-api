const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes    = require('./routes/auth');
const gemRoutes     = require('./routes/gems');
const commentRoutes = require('./routes/comments');
const saveRoutes    = require('./routes/saves');
const userRoutes    = require('./routes/users');
const uploadRoutes  = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/v1/auth',              authRoutes);
app.use('/v1/gems',              gemRoutes);
app.use('/v1/gems/:id/comments', commentRoutes);
app.use('/v1/gems/:id/saves',    saveRoutes);
app.use('/v1/users',             userRoutes);
app.use('/v1/uploads',           uploadRoutes);

app.listen(PORT, () => {
  console.log(`HiddenGem API running on port ${PORT}`);
});