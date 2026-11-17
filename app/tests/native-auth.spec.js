import {test,expect} from '@playwright/test';
// Native shell CSP is tested in native-security; localhost test host has a web-only CSP.
test.use({bypassCSP:true});
const ticket='t'.repeat(43), code='c'.repeat(43), session='s'.repeat(43);
async function mockNative(page, storageFailure=false, {skipIntroduction=true}={}) {
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
  if(skipIntroduction) await page.getByRole('button',{name:'Skip introduction',exact:true}).click();
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

test('native introduction completes three steps, restores focus and can be replayed without a sign-in',async({page})=>{
  const calls=await mockNative(page,false,{skipIntroduction:false});
  const first=page.locator('.welcome-page').getByRole('heading',{name:'Good apps deserve to be found.',exact:true});
  await expect(first).toBeFocused();
  await expect(page.getByRole('button',{name:'Step 1',exact:true})).toHaveAttribute('aria-current','step');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Start with your own app.',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(first).toBeFocused();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Watch what really changes.',exact:true})).toBeFocused();
  await expect(page.getByRole('button',{name:'Step 3',exact:true})).toHaveAttribute('aria-current','step');
  await page.getByRole('button',{name:'Get started',exact:true}).click();
  await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('rankwisp-introduction-v1'))).toBe('seen');
  await page.reload();
  await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeVisible();
  await expect(first).toHaveCount(0);
  await page.getByRole('button',{name:'A quick introduction',exact:true}).click();
  await expect(first).toBeFocused();
  await page.getByRole('button',{name:'Skip introduction',exact:true}).click();
  await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeVisible();
  expect(calls).toHaveLength(0);
  expect(await page.evaluate(()=>window.persistedSession)).toBe(null);
});

test.describe('native introduction follows device language and preserves an explicit choice',()=>{
  test.use({locale:'de-CH'});
  test('German device locale can be switched to English and persists after reload',async({page})=>{
    await mockNative(page,false,{skipIntroduction:false});
    await expect(page.getByRole('heading',{name:'Gute Apps verdienen Sichtbarkeit.',exact:true})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang','de');
    await page.getByRole('button',{name:'Sprache wechseln',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Good apps deserve to be found.',exact:true})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await page.reload();
    await expect(page.getByRole('heading',{name:'Good apps deserve to be found.',exact:true})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang','en');
  });
});

test('native introduction respects reduced motion while keeping the final chart visible',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await mockNative(page,false,{skipIntroduction:false});
  await page.getByRole('button',{name:'Step 3',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Watch what really changes.',exact:true})).toBeVisible();
  await expect(page.locator('.welcome-panel')).toHaveCSS('animation-name','none');
  await expect(page.locator('.welcome-mark')).toHaveCSS('transition-duration','0s');
  await expect(page.locator('.welcome-trail')).toHaveCSS('opacity','1');
  await expect(page.locator('.welcome-trail path')).toHaveCSS('animation-name','none');
  expect(await page.locator('.welcome-trail path').evaluate(node=>parseFloat(getComputedStyle(node).strokeDashoffset))).toBe(0);
  await page.getByRole('button',{name:'Get started',exact:true}).click();
  await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeVisible();
});
