// `npm run mock-aide`: the normal server plus the dev-only mock aide page at /mock-aide/.
// Sets the flag here so the script works the same in PowerShell, cmd and bash.
process.env.MOCK_AIDE = '1';
await import('./index.js');
