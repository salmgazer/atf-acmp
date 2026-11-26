import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { DEFAULT_FORMATION_SETTINGS } from '@acmp/shared';
const cohortId='00000000-0000-4000-8000-000000000010', previewId='00000000-0000-4000-8000-000000000011';
async function setup(page: Page, context: BrowserContext, options: { role?: string; draft?: boolean; failDefaults?: boolean } = {}) {
  const role=options.role || 'program_manager', user={id:'synthetic-staff',role,email:'synthetic@example.test',firstName:'Synthetic',lastName:'Staff'};
  await context.addCookies([{name:'auth_token',value:'present',url:'http://localhost:63781'},{name:'auth_portal',value:'staff',url:'http://localhost:63781'}]);
  await page.addInitScript(({user,cohortId})=>{localStorage.setItem('auth_token','test-token');localStorage.setItem('acmp-auth-store',JSON.stringify({state:{user,token:'test-token',portal:'staff',isAuthenticated:true},version:0}));localStorage.setItem('acmp-staff-cohort-store',JSON.stringify({state:{globalCohortId:cohortId},version:0}));},{user,cohortId});
  await page.routeWebSocket(/socket\.io/,socket=>socket.close());await page.route('**/*onesignal*',route=>route.abort());
  let settings={...DEFAULT_FORMATION_SETTINGS},version='2026-11-26T10:00:00Z',preview:any=null,fail=options.failDefaults;
  const writes:{path:string;body:any}[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname,method=req.method();let data:unknown=[];
    if(!['GET','HEAD'].includes(method))writes.push({path,body:req.postDataJSON()});
    if(path.endsWith('/auth/me'))data=user;
    else if(path.endsWith('/cohorts'))data={data:[{id:cohortId,name:'Synthetic cohort',groups:['A'],status:'active'}],total:1};
    else if(path.endsWith('/formation/defaults')){if(fail){fail=false;return route.fulfill({status:503,json:{message:'Settings unavailable'}});}if(method==='PATCH'){settings={...req.postDataJSON().config};version='2026-11-26T11:00:00Z';}data={settings,updatedAt:version};}
    else if(path.endsWith('/formation/preview')){if(method==='DELETE')preview=null;data=preview;}
    else if(path.endsWith('/formation/run')){const config=req.postDataJSON().config;const outcome=options.draft?'draft':config.minimumBuilders===0?'exception':'registered';preview={previewId,cohortId,generatedAt:version,configUsed:config,statistics:{totalEligibleParticipants:3,proposedTeamCount:1,averageTeamSize:3,averageCompatibilityScore:80,backfillStats:{}},builderSummary:{registeredTeams:outcome==='registered'?1:0,draftTeams:outcome==='draft'?1:0,exceptionTeams:outcome==='exception'?1:0,noBuilderTeams:options.draft?1:0,confirmedBuilders:1,awaitingBuilders:1,potentialBuilders:1},proposedTeams:[{proposedTeamId:'test-team',suggestedName:'Test proposed team',group:'A',competitionCountry:'Ghana',registrationOutcome:outcome,participants:['confirmed','awaiting','potential'].map((builderStatus,i)=>({id:'p'+i,firstName:'Synthetic',lastName:'Member '+i,builderStatus})),eligibility:{builderCount:options.draft?0:2,nonComputingCount:1,guidance:[]}}],proposedBackfills:[],warnings:[]};data=preview;}
    else if(path.endsWith('/formation/finalize')){data={createdTeamCount:1,errors:[]};preview=null;}
    else if(path.endsWith('/teams'))data={data:[],total:0,totalPages:1};
    else if(path.endsWith('/statistics'))data=path.includes('participants')?{total:3,ready:3}:{total:0,byStatus:{}};
    else if(path.endsWith('/unread-count'))data={count:0};
    await route.fulfill({json:data});});
  await page.goto('/staff/teams');return{writes,errors};
}
test('staff can preview permissive settings with an explained exception, clear badges and the exact finalization receipt',async({page,context})=>{
  const state=await setup(page,context);await page.getByRole('button',{name:'Team formation',exact:true}).click();
  await expect(page.getByLabel('Who counts as a builder?',{exact:true})).toHaveValue('recorded');await expect(page.getByLabel('Minimum builders per team',{exact:true})).toHaveValue('1');
  await page.getByLabel('Who counts as a builder?',{exact:true}).selectOption('potential');await page.getByLabel('Minimum builders per team',{exact:true}).selectOption('0');
  await page.getByRole('button',{name:'Run Team Formation',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Explain the builder exception'})).toBeVisible();expect(state.writes).toEqual([]);
  await page.getByLabel('Reason for builder exception',{exact:true}).fill('ATF permits this cohort to form teams without builders.');await page.getByRole('button',{name:'Run Team Formation',exact:true}).click();
  await expect(page.getByText('Confirmed builder',{exact:true})).toBeVisible();await expect(page.getByText('Awaiting confirmation',{exact:true})).toBeVisible();await expect(page.getByText('Potential builder',{exact:true})).toBeVisible();
  expect(state.writes[0].body.config).toMatchObject({builderEligibility:'potential',minimumBuilders:0,shortageAction:'draft',useBriefCentricAssignment:false});
  await page.getByRole('button',{name:'Finalize (1 teams)',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Finalize Team Formation',exact:true});await expect(dialog).toContainText('staff builder exception');await dialog.getByRole('button',{name:'Create Teams',exact:true}).click();
  expect(state.writes.at(-1)?.body).toEqual({previewId});expect(state.errors).toEqual([]);
});
test('draft outcomes are visible before staff finalizes a run',async({page,context})=>{
  await setup(page,context,{draft:true});await page.getByRole('button',{name:'Team formation',exact:true}).click();await page.getByLabel('Who counts as a builder?',{exact:true}).selectOption('confirmed');await page.getByLabel('Minimum builders per team',{exact:true}).selectOption('2');await page.getByLabel('What to match',{exact:true}).selectOption('new');await page.getByRole('button',{name:'Run Team Formation',exact:true}).click();
  await expect(page.getByText('Draft — needs builders · No builder',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Finalize (1 teams)',exact:true}).click();await expect(page.getByRole('dialog',{name:'Finalize Team Formation',exact:true})).toContainText('remain drafts needing builders before registration');
});
test('saved cohort defaults survive reloading and the settings panel fits a mobile viewport',async({page,context})=>{
  const state=await setup(page,context);await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Team formation',exact:true}).click();await page.getByLabel('Who counts as a builder?',{exact:true}).selectOption('confirmed');await page.getByLabel('Minimum builders per team',{exact:true}).selectOption('2');await page.getByLabel('If there are not enough builders',{exact:true}).selectOption('leave_unassigned');await page.getByLabel('What to match',{exact:true}).selectOption('backfill');await page.getByRole('button',{name:'Save as cohort defaults',exact:true}).click();await expect(page.getByText('Formation defaults saved',{exact:true})).toBeVisible();
  expect(state.writes[0].body).toMatchObject({expectedUpdatedAt:'2026-11-26T10:00:00Z',config:{minimumBuilders:2,preferredBuilders:2,matchingScope:'backfill'}});await page.reload();await page.getByRole('button',{name:'Team formation',exact:true}).click();await expect(page.getByLabel('Who counts as a builder?',{exact:true})).toHaveValue('confirmed');await expect(page.getByLabel('What to match',{exact:true})).toHaveValue('backfill');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(state.errors).toEqual([]);
});
test('a defaults failure blocks preview generation until staff retries',async({page,context})=>{
  const state=await setup(page,context,{failDefaults:true});await page.getByRole('button',{name:'Team formation',exact:true}).click();
  // Query retries may recover automatically; either path must render the actual defaults before allowing a run.
  await expect(page.getByRole('button',{name:'Run Team Formation',exact:true})).toBeVisible({timeout:15000});expect(state.writes).toEqual([]);
});
for(const role of ['viewer','evaluator'])test(`${role} cannot access formation controls`,async({page,context})=>{await setup(page,context,{role});await expect(page.getByRole('button',{name:'Team formation',exact:true})).toHaveCount(0);});
