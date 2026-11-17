import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { appURL, googleAuthURL, apiOrigin, policy, assetPath } = require('../desktop/security.cjs');

test('native auth restricts external launch to exact Google OAuth endpoint', () => {
  assert.equal(googleAuthURL('https://accounts.google.com/o/oauth2/v2/auth?state=opaque'), 'https://accounts.google.com/o/oauth2/v2/auth?state=opaque');
  for (const url of ['http://accounts.google.com/o/oauth2/v2/auth','https://accounts.google.com.evil.test/o/oauth2/v2/auth','https://attacker@accounts.google.com/o/oauth2/v2/auth','https://accounts.google.com/o/oauth2/v2/auth#fragment','https://accounts.google.com/logout','file:///etc/passwd','javascript:alert(1)']) assert.throws(() => googleAuthURL(url));
});

test('native origin/CSP permits explicit API endpoint and fails closed', () => {
  assert.equal(apiOrigin({apiOrigin:'https://api.example.com'}),'https://api.example.com');
  assert.equal(apiOrigin({apiOrigin:'http://127.0.0.1:4318'}), null);
  assert.equal(apiOrigin({apiOrigin:'http://127.0.0.1:4318',development:true}),'http://127.0.0.1:4318');
  for (const value of ['https://api.example.com/path','https://user:pass@api.example.com','http://api.example.com','https://api.example.com?leak=yes','https://api.example.com#fragment']) assert.equal(apiOrigin({apiOrigin:value,development:true}),null);
  assert.match(policy('https://api.example.com'), /connect-src 'self' https:\/\/api\.example\.com;/);
  assert.doesNotMatch(policy(null), /accounts\.google\.com|unsafe-eval/);
  assert.equal(appURL('rankwisp://app/app'), true);
  for(const url of ['rankwisp://app.evil/app','rankwisp://user@app/app','rankwisp://app:443/app','https://app/app']) assert.equal(appURL(url),false);
});

test('native assets reject path traversal, symlink escape and unknown files', () => {
  const scratch=mkdtempSync(join(tmpdir(),'rankwisp-security-'));
  const root=join(scratch,'dist');mkdirSync(root);writeFileSync(join(root,'index.html'),'app');
  mkdirSync(join(root,'en'));writeFileSync(join(root,'en','index.html'),'website');
  writeFileSync(join(scratch,'secret'),'not public');symlinkSync(join(scratch,'secret'),join(root,'leak.txt'));
  try{
    assert.equal(assetPath(root,'rankwisp://app/app'),join(root,'index.html'));
    assert.equal(assetPath(root,'rankwisp://app/en/'),join(root,'en','index.html'));
    for(const url of ['rankwisp://app/..%2fsecret','rankwisp://app/%5c..%5csecret','rankwisp://app/%00','rankwisp://app/%ZZ','rankwisp://app/leak.txt','rankwisp://app/missing.js','rankwisp://app.evil/index.html']) assert.equal(assetPath(root,url),null);
  }finally{rmSync(scratch,{recursive:true,force:true});}
});


test('native auth permits only an exact configured backend start ticket', () => {
  const origin='https://rankwisp.pages.dev';
  const ticket='a'.repeat(43);
  const start=origin+'/api/auth/google/start?ticket='+ticket;
  assert.equal(googleAuthURL(start,origin),start);
  assert.throws(()=>googleAuthURL(start));
  for(const url of [start.replace('rankwisp.pages.dev','rankwisp.pages.dev.evil.test'),start+'&next=https://evil.test',start+'&ticket='+ticket,start.replace('/start','/callback'),start.replace(ticket,'short'),start+'#fragment',start.replace('https://','http://')]) assert.throws(()=>googleAuthURL(url,origin));
  assert.equal(googleAuthURL('http://127.0.0.1:4318/api/auth/google/start?ticket='+ticket,apiOrigin({apiOrigin:'http://127.0.0.1:4318',development:true})), 'http://127.0.0.1:4318/api/auth/google/start?ticket='+ticket);
});
