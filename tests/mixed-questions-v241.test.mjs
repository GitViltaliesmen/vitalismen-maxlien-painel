import test from'node:test';import assert from'node:assert/strict';
import{questionPlanV219 as plan,prioritizeFreeflowV219 as priority,formatQuestionAnswerV219 as format}from'../src/services/freeflowQuestionPriorityV219Service.js';
const entry='Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
for(const [text,topics]of[
 [entry,[]],
 [entry+'\nNombre: Gerson',[]],
 ['Quiero conocer la oferta disponible\n¿Qué contiene Vit Power?',['price','ingredients']],
 ['Leí sobre garantía.\nPrecio\n¿Qué contiene Vit Power?',['price','ingredients']],
 ['Precio\n¿Qué contiene Vit Power?',['price','ingredients']],
 ['¿Qué contiene Vit Power?\nPrecio',['ingredients','price']],
 [entry+'\nPrecio\n¿Qué contiene Vit Power?',['price','ingredients']],
 [entry+'\nNombre: Gerson\nPrecio\n¿Qué contiene Vit Power?',['price','ingredients']],
 ['Los precios..\n¿Qué contiene Vit Power?',['price','ingredients']],
 ['Porfavor me indicas la promoción..\n¿Qué contiene Vit Power?',['price','ingredients']],
 ['¿Cómo se usa?\nPrecio\n¿Qué contiene Vit Power?',['usage','price','ingredients']],
 ['¿Cuánto cuesta?\n¿Qué contiene Vit Power?',['price','ingredients']],
 ['Leí sobre garantía.\n¿Qué contiene Vit Power?',['ingredients']],
 ['Tengo información del precio.\n¿Qué contiene Vit Power?',['ingredients']],
 ['Gracias por los precios\n¿Qué contiene Vit Power?',['ingredients']],
 ['¿Qué contiene?\nPrecio\nPrecio',['ingredients','price']],
 ['Nombre: Cliente\nCiudad: Quito\nCantidad: 3',[]],
 ['3 frascos',[]],['Sí, confirmo',[]],['Gracias por los precios',[]],
 ['¿Cuánto cuesta el envío?',['delivery_cost']],
 ['Precio de envío\n¿Qué contiene Vit Power?',['delivery_cost','ingredients']],
 ['¿Qué contiene Vit Power?\nPrecio del flete',['ingredients','delivery_cost']],
 ['¿Aceptan pago contra entrega?\nPrecio',['payment','price']]
])test('ordered mixed questions: '+JSON.stringify(text),()=>assert.deepEqual(plan(text).map(q=>q.topic),topics));
test('other products and disabled priority remain unchanged',()=>{assert.equal(priority({productKey:'tex_ultra_ec',enabled:true,text:'Precio\n¿Qué contiene Vit Power?'}),false);assert.equal(priority({productKey:'nitrix_oxide_ec',enabled:true,text:'Precio'}),false);assert.equal(priority({productKey:'vit_power_ec',enabled:false,text:'Precio'}),false);});
test('price formatting still uses verified official source and does not select or register an order',()=>{const offers=[{quantity:1,total:39.99},{quantity:3,total:95.99},{quantity:6,total:167.99}].map(x=>({...x,ok:true,verified:true,source:'ecuadorProductService',productKey:'vit_power_ec',currency:'USD'}));const text=format('price',{ok:true,verified:true,source:'ecuadorProductService',offers});assert.match(text,/39\.99/);assert.match(text,/95\.99/);assert.match(text,/167\.99/);assert.throws(()=>format('price',{ok:true,verified:true,source:'unverified',offers:[{...offers[0],verified:false}]}));});
