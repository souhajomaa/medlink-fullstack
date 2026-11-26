// Charge les secrets (Vault) AVANT d'importer l'application :
// db.js et encryption.js lisent leurs secrets au moment de l'import.
import { loadSecrets } from './shared/utils/secrets.js';

const target = process.argv[2] || './index.js';   // ex. : node src/bootstrap.js ./seed.js

await loadSecrets();
await import(target);