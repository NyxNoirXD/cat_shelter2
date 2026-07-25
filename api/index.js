let app = null;

module.exports = async (req, res) => {
  if (!app) {
    try {
      const createApp = require('../app');
      app = await createApp();
    } catch (err) {
      console.error('Failed to initialize Express app:', err);
      res.status(500).json({ success: false, error: 'Server initialization failed' });
      return;
    }
  }
  return app(req, res);
};
