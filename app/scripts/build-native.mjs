import {spawnSync} from 'node:child_process';
const origin=process.env.NATIVE_API_ORIGIN;
if(!origin||!/^https:\/\/[^/]+$/.test(origin))throw Error('Set NATIVE_API_ORIGIN to the deployed HTTPS origin before building native releases.');
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{stdio:'inherit',env:{...process.env,VITE_API_ORIGIN:origin,NATIVE_LOCAL_DEVELOPMENT:'false'}});
process.exit(result.status??1);
