import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portalRequest } from '../worker/transport';

test('portal requests retry a lost connection but never a server reply',async()=>{
  const saved={fetch:globalThis.fetch,url:process.env.ZORA_APP_URL,token:process.env.ZORA_TEST_RUNNER,bypass:process.env.ZORA_NOTIFICATION_BYPASS};
  process.env.ZORA_APP_URL='https://zora.example';process.env.ZORA_TEST_RUNNER='t'.repeat(40);delete process.env.ZORA_NOTIFICATION_BYPASS;
  try{
    let calls=0;
    globalThis.fetch=(async()=>{calls++;if(calls===1)throw new TypeError('fetch failed');return new Response('{}',{status:200});}) as typeof fetch;
    assert.equal((await portalRequest('/api/x','ZORA_TEST_RUNNER',{a:1})).status,200);assert.equal(calls,2);
    calls=0;globalThis.fetch=(async()=>{calls++;return new Response('no',{status:500});}) as typeof fetch;
    await assert.rejects(portalRequest('/api/x','ZORA_TEST_RUNNER',{a:1}),/Routine endpoint failed \(500\)/);assert.equal(calls,1);
  }finally{
    globalThis.fetch=saved.fetch;
    for(const [k,v] of [['ZORA_APP_URL',saved.url],['ZORA_TEST_RUNNER',saved.token],['ZORA_NOTIFICATION_BYPASS',saved.bypass]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});
