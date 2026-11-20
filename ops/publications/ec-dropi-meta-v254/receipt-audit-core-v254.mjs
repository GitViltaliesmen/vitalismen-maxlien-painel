import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export function transportPayloadFromMongoV254(payload){
 const transport=structuredClone(payload),omitted=[];
 // The frozen sender assigns undefined to these two non-applicable fields.
 // JSON transport omits them; the Mongo driver stores those undefined values as null.
 for(const event of transport.data||[]){
  if(event.action_source!=='business_messaging'&&event.messaging_channel===null){delete event.messaging_channel;omitted.push('messaging_channel');}
  if(event.action_source!=='website'&&event.event_source_url===null){delete event.event_source_url;omitted.push('event_source_url');}
 }
 return {transport,omitted};
}
export function verifyTransportHashV254(row){const proof=transportPayloadFromMongoV254(row.payload);assert.equal(createHash('sha256').update(JSON.stringify(proof.transport)).digest('hex'),row.requestSha256);return proof;}
export function verifyGuideProjectionV254({order,shipment,guide}){assert.equal(shipment.logistics?.trackingNumber,guide);if(order.trackingNumber)assert.equal(order.trackingNumber,guide);return{authoritativeShipmentGuide:true,optionalOrderMirrorPresent:Boolean(order.trackingNumber)};}
