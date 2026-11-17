const fs=require('node:fs');
// Keep the native clock throughout the sealed guards and application.
const actualFetch=globalThis.fetch;
globalThis.fetch=async function(input,options){
 const url=String(input?.url||input);
 if(!url.startsWith('https://api.openai.com/'))return actualFetch(input,options);
 const request=JSON.parse(options.body),messages=request.messages;
 const latest=messages.findLastIndex(m=>m.role==='user'),text=messages[latest].content;
 const after=messages.slice(latest+1),called=after.filter(m=>m.role==='assistant').flatMap(m=>m.tool_calls||[]);
 const results=after.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));
 const tool=(name,args={})=>({id:'SIM_'+called.length+'_'+name,type:'function',function:{name,arguments:JSON.stringify(args)}});
 const speak=content=>({role:'assistant',content});
 const call=(...calls)=>({role:'assistant',content:null,tool_calls:calls});
 let next;
 const capture=(field,value,evidence)=>tool('capture_customer_detail',{field,value,evidence});
 const first=called.length===0;
 if(text.includes('Quiero 3 frascos. Estoy en Quito.'))next=first?call(capture('quantity',3,'Quiero 3 frascos'),capture('city','Quito','Estoy en Quito')):speak('Tengo 3 frascos y Quito. ¿Prefiere una agencia Servientrega o domicilio?');
 else if(text.includes('Me llamo Carlos Prueba. Entrega a domicilio.'))next=first?call(capture('name','Carlos Prueba','Me llamo Carlos Prueba'),capture('deliveryMode','home','Entrega a domicilio')):speak('Gracias, Carlos. ¿Cuál es la dirección de entrega?');
 else if(text.includes('La provincia es Pichincha. Dirección: Avenida Simulada 123.')){
  if(first)next=call(capture('province','Pichincha','La provincia es Pichincha'),capture('address','Avenida Simulada 123','Dirección: Avenida Simulada 123'),capture('reference','junto al parque','Referencia: junto al parque'));
  else if(!called.some(c=>c.function.name==='prepare_order_summary'))next=call(tool('prepare_order_summary'));
  else next=speak(results.findLast(r=>r.summary)?.summary||'Necesito verificar los datos faltantes.');
 }
 else if(text.includes('La dirección correcta es Avenida Simulada 456.')){
  if(first)next=call(capture('address','Avenida Simulada 456','La dirección correcta es Avenida Simulada 456'));
  else if(!called.some(c=>c.function.name==='prepare_order_summary'))next=call(tool('prepare_order_summary'));
  else next=speak(results.findLast(r=>r.summary)?.summary||'Necesito revisar la dirección.');
 }
 else if(/^(?:Confirmo|Confirmo el pedido|Sí, confirmo|No confirmo, quiero revisar)\.?$/.test(text.trim())){
  if(first)next=call(tool('register_confirmed_order'));
  else next=speak(results.some(r=>r.registered)?'Su pedido fue registrado.':'Aún necesito completar o confirmar los datos del resumen.');
 }
 else if(text.includes('Quiero hablar con una persona'))next=first?call(tool('request_human',{reason:'customer_requests_human'})):speak('Voy a pedir apoyo de una persona del equipo.');
 else next=speak('Le ayudo con su consulta.');
 fs.appendFileSync(process.env.SIM_MODEL_TRACE,JSON.stringify({at:new Date().toISOString(),text,toolCalls:(next.tool_calls||[]).map(c=>c.function.name),toolResults:results.map(r=>({ok:r.ok,reason:r.reason,missingFields:r.missingFields,registered:r.registered}))})+'\n');
 return new Response(JSON.stringify({choices:[{message:next}]}),{status:200,headers:{'content-type':'application/json'}});
};
