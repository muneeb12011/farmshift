import { api, web, installed, killTree, requireNode, run } from './_lib.mjs';

requireNode();
if (!installed(api) || !installed(web)) {
  console.error('\nDependencies are not installed yet. Run:  npm run setup\n');
  process.exit(1);
}

const apiProc = run('npm', ['run', 'dev'], api, 'api', '36');
const webProc = run('npm', ['run', 'dev'], web, 'web', '35');
console.log('\nFarmShift starting:\n  frontend  http://localhost:3000\n  API       http://localhost:4000   (docs: http://localhost:4000/docs)\n');

const stop = () => {
  killTree(apiProc);
  killTree(webProc);
  setTimeout(() => process.exit(0), 300);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const [p, name] of [[apiProc, 'api'], [webProc, 'web']]) {
  p.on('exit', (code) => {
    if (code) console.error(`\n[${name}] exited with code ${code}; stopping.`);
    stop();
  });
}
