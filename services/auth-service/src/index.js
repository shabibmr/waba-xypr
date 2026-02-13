require('./server').start().catch(err => {
  console.error('Fatal: failed to start auth service:', err.message);
  process.exit(1);
});
