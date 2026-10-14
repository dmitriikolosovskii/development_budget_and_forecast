// Preloaded by the seed runner (prisma.config.ts): resolves @default-project/* from tsconfig.base.json.
// tsconfig.base.json has `paths` without `baseUrl`, so the base URL is given explicitly.
const path = require('node:path');

process.env.TS_NODE_PROJECT = path.join(__dirname, '../tsconfig.app.json');
process.env.TS_NODE_BASEURL = path.join(__dirname, '../../..');
require('tsconfig-paths/register');
