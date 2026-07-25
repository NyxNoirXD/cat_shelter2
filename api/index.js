let app = null;

module.exports = async (req, res) => {
  if (!app) {
    const createApp = require('../app');
    app = await createApp();
  }
  return app(req, res);
};
