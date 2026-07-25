const createApp = require('./app');

const PORT = process.env.PORT || 3000;

createApp().then(app => {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Whiskers & Haven Pet Adoption Center Server Running`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`  Account Login: http://localhost:${PORT}/login`);
    console.log(`====================================================`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or run: PORT=3001 npm start`);
    } else {
      console.error('Failed to start server:', err.message);
    }
    process.exit(1);
  });
}).catch(err => {
  console.error('Failed to initialize application:', err);
  process.exit(1);
});
