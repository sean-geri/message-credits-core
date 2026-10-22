const { config } = require('dotenv');
const { join } = require('path');

config({ path: join(__dirname, '../.env.test'), override: true });

require('reflect-metadata');
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
  },
});

module.exports = async () => {
  const { AppDataSource } = require('../src/database/data-source.ts');

  await AppDataSource.initialize();
  await AppDataSource.runMigrations();
  await AppDataSource.destroy();
};
