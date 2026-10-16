import {z} from 'zod';

export const sourceCategories={requirements:'Requirements / RFP',transcript:'Call transcript / meeting notes',answers:'Buyer answers / clarifications',reference:'Reference / example',template:'Document template',commercial:'Commercial input',other:'Other source'} as const;
export const sourceContextSchema=z.object({
  category:z.enum(['requirements','transcript','answers','reference','template','commercial','other']),
  label:z.string().trim().max(100).default(''),
  notes:z.string().trim().max(3000).default(''),
}).strict();
export type SourceContext=z.infer<typeof sourceContextSchema>;
