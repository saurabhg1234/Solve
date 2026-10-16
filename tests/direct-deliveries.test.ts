import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readDeliveryBody,DELIVERY_REQUEST_BYTES} from '../lib/direct-deliveries';

test('delivery body is bounded while streaming, including absent content-length',async()=>{
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(DELIVERY_REQUEST_BYTES));controller.enqueue(new Uint8Array(1));controller.close();}});
  const request=new Request('http://localhost/delivery',{method:'POST',body,duplex:'half'} as RequestInit);
  await assert.rejects(readDeliveryBody(request),(e:any)=>e.status===413);
  await assert.rejects(readDeliveryBody(new Request('http://localhost/delivery',{method:'POST',body:'{broken'})),(e:any)=>e.status===400);
});
