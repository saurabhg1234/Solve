import {readFile,realpath,stat,writeFile} from 'node:fs/promises';
import {dirname,resolve,sep,basename} from 'node:path';
import {z} from 'zod';
import {deliverySchema,DELIVERY_BYTES} from '../lib/direct-deliveries';
import {hashBytes} from '../lib/files';
import {nativeContext} from '../lib/native-context';
import {portalRequest} from '../worker/transport';

const planSchema=deliverySchema.omit({contextId:true,files:true}).extend({
  files:z.array(z.object({path:z.string().min(1),mimeType:deliverySchema.shape.files.element.shape.mimeType}).strict()).min(1).max(8),
}).strict();
/** Publish actual on-request outputs without inventing a leased stage or independent review. */
export async function deliverWork(path:string){
  const actual=await realpath(resolve(path)),dir=dirname(actual),plan=planSchema.parse(JSON.parse(await readFile(actual,'utf8')));
  const files=[];let size=0;
  for(const file of plan.files){
    const target=await realpath(resolve(dir,file.path));if(!target.startsWith(dir+sep)||!(await stat(target)).isFile())throw new Error('Delivery file escapes its plan directory');
    size+=(await stat(target)).size;if(size>DELIVERY_BYTES)throw new Error('Delivery files exceed 2 MB');
    const bytes=await readFile(target);files.push({filename:basename(target),mimeType:file.mimeType,sha256:hashBytes(bytes),base64:bytes.toString('base64')});
  }
  const payload=deliverySchema.parse({...plan,contextId:nativeContext(),files});
  const receipt=await(await portalRequest('/api/worker/deliveries','ZORA_RUNNER_TOKEN',payload)).json();
  await writeFile(actual+'.receipt.json',JSON.stringify({recordedAt:new Date().toISOString(),...receipt,files:files.map(({filename,sha256})=>({filename,sha256}))},null,2),{mode:0o600});
  console.log(JSON.stringify({recorded:true,...receipt,fileCount:files.length}));
}
