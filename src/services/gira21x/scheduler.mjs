import {giraRuntimePolicy} from './runtime-policy.mjs';
let timer;
export function startGiraBridgeScheduler({run,schedule=setInterval}={}){
 if(!giraRuntimePolicy.approved())return {started:false,reason:'GIRA_RUNTIME_PROFILE_REQUIRED'};
 if(timer)return {started:false,reason:'ALREADY_STARTED'};
 timer=schedule(()=>{void run().catch(()=>console.warn('[GIRA21X] cycle requires review'));},60000);timer?.unref?.();
 return {started:true,intervalMs:60000,legacySchedulersChanged:false};
}
