import {execFileSync} from 'node:child_process';
import {mkdirSync, existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const run = (cmd, args) => execFileSync(cmd, args, {encoding:'utf8', stdio:['pipe','pipe','pipe']}).trim();
const docker = (...args) => run('docker', args);
const prefix = 'fut-stats-personal-';
const mode = process.argv[2];
const state = resolve('.orca-personal');
const key = resolve(state, 'id_ed25519');
const known = resolve(process.env.HOME, '.ssh/known_hosts');
function result(id) {
  const port = Number(docker('port', id, '22/tcp').split(':').at(-1));
  const hostKey = docker('exec', id, 'cat', '/etc/ssh/ssh_host_ed25519_key.pub');
  const endpoint = `[127.0.0.1]:${port}`;
  mkdirSync(resolve(process.env.HOME, '.ssh'), {recursive:true, mode:0o700});
  if (existsSync(known)) run('ssh-keygen', ['-R', endpoint, '-f', known]);
  // Key obtained through the local Docker daemon, never an unverified network scan.
  execFileSync('tee', ['-a', known], {input:`${endpoint} ${hostKey}\n`, stdio:['pipe','ignore','pipe']});
  return {schemaVersion:1, connection:{type:'ssh',projectRoot:'/workspace/fut-stats',target:{label:'Fut Stats personal Docker',host:'127.0.0.1',port,username:'agent',identityFile:key,identitiesOnly:true}},userData:{resourceId:id,provider:'local-docker'}};
}
if (mode === 'create') {
  const instance = process.env.ORCA_VM_INSTANCE_ID;
  if (!instance || !/^[a-zA-Z0-9-]+$/.test(instance)) throw Error('Missing or invalid ORCA_VM_INSTANCE_ID');
  const name = prefix + instance;
  mkdirSync(state, {recursive:true,mode:0o700});
  if (!existsSync(key)) run('ssh-keygen',['-t','ed25519','-N','','-f',key]);
  let id;
  try { id = docker('inspect','--format','{{.Id}}',name); } catch {}
  if (!id) {
    id = docker('run','-d','--name',name,'--label','fut-stats.personal=true','-p','127.0.0.1::22','-e',`ORCA_SSH_PUBLIC_KEY=${readFileSync(key+'.pub','utf8').trim()}`,'fut-stats-personal-authenticated');
  } else docker('start',id);
  try {
    let ready = false;
    for (let i=0;i<40;i++) {
      try { docker('exec',id,'test','-f','/etc/ssh/ssh_host_ed25519_key.pub'); ready=true; break; } catch {}
      await new Promise(r=>setTimeout(r,250));
    }
    if (!ready) throw Error('SSH startup failed');
    const login = docker('exec','-u','agent',id,'gh','api','user','--jq','.login');
    if (login !== 'joaopedropaixao') throw Error('GitHub personal identity mismatch');
    docker('exec','-u','agent',id,'gh','auth','setup-git');
    docker('exec','-u','agent',id,'bash','-c','test -d /workspace/fut-stats/.git || git clone https://github.com/joaopedropaixao/fut-stats.git /workspace/fut-stats');
    console.log(JSON.stringify(result(id)));
  } catch(e) {
    console.error(`Container preserved for diagnosis: ${name}`);
    throw e;
  }
} else if (mode === 'destroy') {
  const payload = JSON.parse(readFileSync(0,'utf8'));
  const id = payload.recipeResult?.userData?.resourceId;
  if (!id) throw Error('Missing resourceId; refusing ambiguous removal');
  if (docker('inspect','--format','{{index .Config.Labels "fut-stats.personal"}}',id) !== 'true') throw Error('Wrong container label');
  // A stopped container is retained: inspect its work before any removal.
  const paths = docker('exec','-u','agent',id,'git','-C','/workspace/fut-stats','worktree','list','--porcelain').split('\n').filter(l=>l.startsWith('worktree ')).map(l=>l.slice(9));
  for (const path of paths) {
    if (docker('exec','-u','agent',id,'git','-C',path,'status','--porcelain')) throw Error(`Uncommitted work: ${path}; container preserved`);
    if (docker('exec','-u','agent',id,'git','-C',path,'log','--branches','--not','--remotes','--oneline')) throw Error('Unpushed commits; container preserved');
  }
  docker('rm','-f',id);
  console.log(JSON.stringify({removed:id}));
} else throw Error('Unknown lifecycle action');
