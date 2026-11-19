import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const R=fs.realpathSync('/opt/vitalismen-automacao/current'),require=createRequire(R+'/package.json');
const {chromium}=require('playwright');
const {parseDropiJwtClaims,isUnexpiredDropiToken,sameDropiAccountIdentity,requestDropiBff,normalizeDropiBffListResponse}=await import(pathToFileURL(R+'/src/services/dropiBffAdapter.js').href);
const AUTH_BFF_BASE_URL='https://api-v2.dropi.ec/bff/auth/core';
const TOTP_SECRET_FILE_PATH=process.env.DROPI_TOTP_SECRET_FILE||process.env.DROPPI_TOTP_SECRET_FILE||path.join(process.env.HOME,'.vitalismen-secrets','dropi-2fa.env');
const normalizeTotpSecret = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        if (/^otpauth:\/\//i.test(raw)) {
            return new URL(raw).searchParams.get('secret') || '';
        }
    } catch {
        return '';
    }
    return raw.replace(/^["']|["']$/g, '');
};

const getDropiEcTotpSecret = () => {
    const envSecret = normalizeTotpSecret(process.env.DROPI_EC_TOTP_SECRET || process.env.DROPPI_EC_TOTP_SECRET || '');
    if (envSecret) return envSecret;
    if (!fs.existsSync(TOTP_SECRET_FILE_PATH)) return '';
    const content = fs.readFileSync(TOTP_SECRET_FILE_PATH, 'utf8');
    const values = {};
    for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!match) continue;
        values[match[1]] = normalizeTotpSecret(match[2]);
    }
    return values.DROPI_EC_TOTP_SECRET || values.DROPPI_EC_TOTP_SECRET || '';
};

const base32Decode = (secret) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = String(secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = '';
    const bytes = [];
    for (const char of clean) {
        const value = alphabet.indexOf(char);
        if (value < 0) continue;
        bits += value.toString(2).padStart(5, '0');
        while (bits.length >= 8) {
            bytes.push(Number.parseInt(bits.slice(0, 8), 2));
            bits = bits.slice(8);
        }
    }
    return Buffer.from(bytes);
};

const generateTotpCode = ({ secret, timeMs = Date.now(), stepSeconds = 30, digits = 6 } = {}) => {
    const key = base32Decode(secret);
    if (!key.length) return '';
    const counter = Math.floor(timeMs / 1000 / stepSeconds);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter >>> 0, 4);
    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary = ((hmac[offset] & 0x7f) << 24)
        | ((hmac[offset + 1] & 0xff) << 16)
        | ((hmac[offset + 2] & 0xff) << 8)
        | (hmac[offset + 3] & 0xff);
    return String(binary % (10 ** digits)).padStart(digits, '0');
};

const unwrapOfficialAuthResponse = (body = {}) => ({
    isSuccess: (body?.is_successful ?? body?.is_succesfull ?? body?.isSuccess) === true,
    message: body?.status_reason || '',
    ...(body?.data && typeof body.data === 'object' ? body.data : {})
});

const officialAuthPost = async (page, endpoint, payload) => page.evaluate(async ({ endpointArg, payloadArg }) => {
    try {
        const response = await fetch(endpointArg, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'x-captcha-token': ''
            },
            body: JSON.stringify(payloadArg)
        });
        return {
            ok: response.ok,
            status: response.status,
            body: await response.json().catch(() => ({}))
        };
    } catch {
        return { ok: false, status: 0, body: {} };
    }
}, { endpointArg: endpoint, payloadArg: payload });

const isFinalDropiLoginResult = (loginResult = {}) => {
    const claims = parseDropiJwtClaims(loginResult?.token || '');
    return Boolean(
        loginResult?.isSuccess
        && loginResult?.token
        && loginResult?.objects?.id
        && isUnexpiredDropiToken(loginResult.token)
        && String(claims.token_type || '').toUpperCase() !== '2FA'
        && String(claims.aud || '').toUpperCase() !== 'CONFIG'
    );
};

const setOfficialDropiSessionStorage = async (page, loginResult) => page.evaluate((value) => {
    const setJson = (key, item) => window.localStorage.setItem(key, JSON.stringify(item ?? null));
    setJson('DROPI_token', value.token);
    setJson('DROPI_LoginResult', value);
    setJson('DROPI_configurations', value.configurations || []);
    setJson('DROPI_plans', value.plans || []);
    setJson('DROPI_distribution_companies', value.distribution_companies || []);
    setJson('email_verified', value.objects?.email_account_verified || false);
}, loginResult);

const validateCurrentDropiBffSession=async page=>{
 const login=await page.evaluate(()=>JSON.parse(localStorage.getItem('DROPI_LoginResult')||'null'));
 if(!isFinalDropiLoginResult(login))return{ok:false,status:401};
 const url=new URL('https://api-v2.dropi.ec/bff/orders/myorders/v2');
 for(const[k,v]of Object.entries({user_id:login.objects.id,exportAs:'orderByRow',orderBy:'id',orderDirection:'desc',result_number:1,start:0,status:'null',supplier_id:'false'}))url.searchParams.set(k,String(v));
 const r=await requestDropiBff({url:url.href,token:login.token,countryCode:'ec',operation:'list',method:'GET',timeoutMs:30000});
 return{ok:r.ok&&normalizeDropiBffListResponse(r.body,r.listResponseContext).isSuccess,status:r.status};
};
const performOfficialBffLogin = async ({ page, capturedPayload, expectedLoginResult, email, password }) => {
    if (!capturedPayload?.white_brand_id) {
        throw new Error('DROPI_AUTH_FAILED AUTH_REQUEST_NOT_CAPTURED');
    }

    const basePayload = {
        ...capturedPayload,
        email: String(email || '').trim().toLowerCase(),
        password,
        with_cdc: false
    };
    delete basePayload.otp;

    const preflight = await officialAuthPost(
        page,
        `${AUTH_BFF_BASE_URL}/beforeLoginUnknownDevice`,
        basePayload
    );
    const preflightData = preflight?.body?.data || {};
    if (!preflight.ok) throw new Error(`DROPI_AUTH_FAILED HTTP_${preflight.status || 0}`);
    if (Number(preflightData.login_otp || 0) === 1) {
        throw new Error('DROPI_AUTH_FAILED EMAIL_OTP_REQUIRED');
    }

    const firstAttempt = await officialAuthPost(page, `${AUTH_BFF_BASE_URL}/login`, {
        ...basePayload,
        otp: null
    });
    let loginResult = unwrapOfficialAuthResponse(firstAttempt.body);

    if (!isFinalDropiLoginResult(loginResult)) {
        const secret = getDropiEcTotpSecret();
        if (!secret) throw new Error('DROPI_AUTH_FAILED TOTP_SECRET_UNAVAILABLE');
        const totp = generateTotpCode({ secret });
        if (!totp) throw new Error('DROPI_AUTH_FAILED TOTP_GENERATION_FAILED');
        const secondAttempt = await officialAuthPost(page, `${AUTH_BFF_BASE_URL}/login`, {
            ...basePayload,
            otp: totp
        });
        loginResult = unwrapOfficialAuthResponse(secondAttempt.body);
        if (!secondAttempt.ok || !isFinalDropiLoginResult(loginResult)) {
            throw new Error(`DROPI_AUTH_FAILED HTTP_${secondAttempt.status || 0}`);
        }
    }

    if (!sameDropiAccountIdentity(expectedLoginResult, loginResult)) {
        throw new Error('DROPI_AUTH_FAILED ACCOUNT_IDENTITY_MISMATCH');
    }

    await setOfficialDropiSessionStorage(page, loginResult);
    const probe = await validateCurrentDropiBffSession(page);
    if (!probe.ok) throw new Error(`DROPI_AUTH_FAILED BFF_HTTP_${probe.status || 0}`);
};

const original='/root/.vitalismen-secrets/droppi-ec-storage.json';
const state=JSON.parse(fs.readFileSync(original,'utf8'));
const expectedLoginResult=JSON.parse(state.origins.find(x=>x.origin==='https://app.dropi.ec').localStorage.find(x=>x.name==='DROPI_LoginResult').value);
const target=process.env.DROPPI_EC_STORAGE_STATE_PATH;
if(!target||!path.isAbsolute(target)||target===original)throw Error('CANDIDATE_SESSION_PATH_REQUIRED');
const browser=await chromium.launch({headless:true}),context=await browser.newContext({storageState:state}),page=await context.newPage();
// Keep geography and browser identity; clear only private-context auth so a
// still-valid token near expiry cannot redirect the login form away.
await context.addInitScript(()=>{if(location.origin==='https://app.dropi.ec'&&location.pathname.startsWith('/auth/login')){localStorage.removeItem('DROPI_token');localStorage.removeItem('DROPI_LoginResult')}});
let capturedPayload;
page.on('request',request=>{if(request.method()==='POST'&&request.url()==='https://api-v2.dropi.ec/bff/auth/core/beforeLoginUnknownDevice'){
 try{capturedPayload=request.postDataJSON()}catch{}}});
try{
 await page.goto('https://app.dropi.ec/auth/login',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('input[type="email"],#email').first().fill(process.env.DROPI_EC_EMAIL);
 await page.locator('input[type="password"]').first().fill(process.env.DROPI_EC_PASSWORD);
 await page.waitForTimeout(500);
 await page.locator('button').filter({hasText:/^(Log in|Ingresar|Iniciar sesi[oó]n)$/i}).first().click();
 for(let i=0;i<20&&!capturedPayload;i++)await page.waitForTimeout(250);
 await performOfficialBffLogin({page,capturedPayload,expectedLoginResult,email:process.env.DROPI_EC_EMAIL,password:process.env.DROPI_EC_PASSWORD});
 // Preserve only the already-verified Ecuador geography cache. Authentication
 // remains entirely from the new successful official login.
 const origin=state.origins.find(x=>x.origin==='https://app.dropi.ec');
 const geography=(origin?.localStorage||[]).filter(x=>['DROPI_cities','DROPI_departments','DROPI_SessionData'].includes(x.name));
 await page.evaluate(entries=>{for(const item of entries)localStorage.setItem(item.name,item.value)},geography);
 await context.storageState({path:target});fs.chmodSync(target,0o600);
 console.log(JSON.stringify({success:true,officialBffListVerified:true,accountIdentityPreserved:true,ordersCreated:0,messagesSent:0}));
}catch(error){
 const code=String(error.message||'FAILED').match(/DROPI_AUTH_FAILED [A-Z0-9_]+/);
 console.log(JSON.stringify({success:false,reason:code?code[0]:'OFFICIAL_AUTH_FLOW_INCOMPLETE',ordersCreated:0,messagesSent:0}));process.exitCode=2;
}finally{await context.close();await browser.close()}
