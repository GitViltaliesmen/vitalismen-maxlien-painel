import test from 'node:test';
import assert from 'node:assert/strict';
import { questionPlanV219, prioritizeFreeflowV219 } from '../src/services/freeflowQuestionPriorityV219Service.js';
import { fixture } from './principal-sdr-freeflow.test.mjs';

for (const text of ['Precio', 'Los precios..', 'Porfavor me indicas la promoción..\nLos precios..', 'La oferta', 'Por favor, dime el precio', 'Me indica la promoción']) {
  test('V239 price request without punctuation: ' + text, () => {
    assert.deepEqual(questionPlanV219(text).map(x => x.topic), ['price']);
    assert.equal(prioritizeFreeflowV219({productKey:'vit_power_ec',enabled:true,text}), true);
  });
}
test('V239 new price answer does not repeat the quantity question already sent', async () => {
  const f=fixture({questionPriorityEnabled:true,context:{draft:{name:'Cliente de prueba'},previousQuestionKeys:['ask_quantity']},price:q=>({1:39.99,3:95.99,6:167.99})[q],script:[
    {role:'assistant',content:null,tool_calls:[{id:'catalog_v239',type:'function',function:{name:'consult_price_options',arguments:'{}'}}]},
    {role:'assistant',content:'Claro. ¿Cuántos frascos desea?'}
  ]});
  const r=await f.send({phone:'593999000001',messageId:'price_request_v239',text:'Porfavor me indicas la promoción..\nLos precios..'});
  assert.equal(r.send,true);assert.equal(r.orderedQuestionVersion,219);
  assert.match(r.reply,/39\.99/);assert.match(r.reply,/95\.99/);assert.match(r.reply,/167\.99/);
  assert.doesNotMatch(r.reply,/cu[aá]ntos/i);assert.equal(f.effects.orders.length,0);assert.equal(f.effects.handoffs.length,0);
});
test('V239 statements, structured order, selected quantity and human product isolation remain unchanged',()=>{
  for(const text of ['3 frascos','Sí, confirmo','Gracias por los precios','Nombre: Cliente\nCiudad: Quito\nCantidad: 3'])assert.deepEqual(questionPlanV219(text),[]);
  assert.equal(prioritizeFreeflowV219({productKey:'tex_ultra_ec',enabled:true,text:'Precio'}),false);
  assert.equal(prioritizeFreeflowV219({productKey:'vit_power_ec',enabled:false,text:'Precio'}),false);
});
