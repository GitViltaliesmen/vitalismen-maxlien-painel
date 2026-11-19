const fs=require('node:fs');
const nativeFetch=globalThis.fetch;
globalThis.fetch=async function(input,options){
 const url=String(input?.url||input);
 if(!url.startsWith('https://api.openai.com/'))return nativeFetch(input,options);
 fs.appendFileSync(process.env.SIM_MODEL_TRACE,JSON.stringify({unexpectedModelCall:true})+'\n');
 throw Error('TEX_NATIVE_PATH_UNEXPECTED_MODEL_CALL');
};
