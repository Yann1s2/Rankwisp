import {test,expect} from '@playwright/test';
// Native shell CSP is tested in native-security; localhost test host has a web-only CSP.
test.use({bypassCSP:true});
const ticket='t'.repeat(43), code='c'.repeat(43), session='s'.repeat(43);
async function mockNative(page, storageFailure=false) {
  await page.addInitScript((storageFailure)=>{
    AbortSignal.timeout=undefined;AbortSignal.any=undefined;
    window.fixtureSessionFailure=storageFailure;window.fixtureSessionValue=null;window.authListeners=[];window.openedAuth=[];window.persistedSession=null;
    window.rankwisp={platform:'darwin',getSession:async()=>{if(window.fixtureSessionFailure)throw Error("LOCKED");return window.fixtureSessionValue;},setSession:async(value)=>{window.persistedSession=value;},openAuth:async(url)=>{window.openedAuth.push(url);},onAuthCompleted:(listener)=>{window.authListeners.push(listener);return()=>{window.authListeners=window.authListeners.filter(x=>x!==listener);};}};
  },storageFailure);
  const calls=[];let authenticated=false;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(route.request().headers().authorization==='Bearer '+session) authenticated=true;
    if(path.endsWith('/config')) return route.fulfill({json:{authProvider:'google',googleConfigured:true}});
    if(path.endsWith('/native/start')) {calls.push({path,body:route.request().postDataJSON()});return route.fulfill({json:{ticket,url:new URL(route.request().url()).origin+'/api/auth/google/start?ticket='+ticket,expiresIn:600}});}
    if(path.endsWith('/native/exchange')) {calls.push({path,body:route.request().postDataJSON()});authenticated=true;return route.fulfill({json:{token:session}});}
    if(!authenticated)return route.fulfill({status:401,json:{error:'SIGN_IN_REQUIRED'}});
    if(path.endsWith('/me'))return route.fulfill({json:{account:{id:'native-fixture',email:'native@example.test',hasPassword:false},license:{state:'trial',daysRemaining:24,checksRemaining:120,aiRemaining:8}}});
    if(path.endsWith('/workspace'))return route.fulfill({json:{workspace:{schemaVersion:1,projects:[],automaticUpdates:false},revision:'fixture'}});
    return route.fulfill({json:{ok:true}});
  });
  await page.goto('/app');
  return calls;
}
test('native login requires this device callback before token exchange and secure persistence',async({page})=>{
  const calls=await mockNative(page);
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.openedAuth.length)).toBe(1);
  expect(calls.map(x=>x.path)).toEqual(['/api/auth/google/native/start']);
  await page.evaluate(({ticket,code})=>window.authListeners.forEach(fn=>fn({ticket:'wrong',code})),{ticket,code});
  expect(calls).toHaveLength(1);
  await page.evaluate(({ticket,code})=>window.authListeners.forEach(fn=>fn({ticket,code})),{ticket,code});
  await expect(page.getByRole('heading',{name:'Meet your next chapter.'})).toBeVisible();
  const exchange=calls.find(x=>x.path.endsWith('/exchange')).body;
  expect(exchange).toMatchObject({ticket,completionCode:code});
  expect(exchange.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await page.evaluate(()=>window.persistedSession)).toBe(session);
  expect(await page.evaluate(()=>window.authListeners.length)).toBe(0);
});
test('native login cancellation removes callback listener without exchanging a session',async({page})=>{
  const calls=await mockNative(page);
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.openedAuth.length)).toBe(1);
  await page.getByRole('button',{name:'Cancel sign-in',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.authListeners.length)).toBe(0);
  expect(calls).toHaveLength(1);
  expect(await page.evaluate(()=>window.persistedSession)).toBe(null);
  await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeEnabled();
});

 test('native secure-storage retry recovers a temporarily unavailable keychain',async({page})=>{
  await mockNative(page,true);
  await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
  await page.evaluate(value=>{window.fixtureSessionFailure=false;window.fixtureSessionValue=value;},session);
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Meet your next chapter.'})).toBeVisible();
 });
