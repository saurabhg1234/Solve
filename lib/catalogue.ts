export const workflows = [
  { id: 'W1', title: 'Exploratory intro deck', short: 'Intro deck', description: 'Understand the company. Connect five sourced pain points to the right solutions.', formats: ['PPTX'], icon: 'presentation', required: ['Company name', 'Approved slide templates'], category: 'Discover' },
  { id: 'W2', title: 'Demo & video showcase', short: 'Showcase', description: 'Curate the most relevant existing demos, with a focused talk track.', formats: ['Shortlist'], icon: 'play', required: ['Topic or industry', 'Approved demo library'], category: 'Discover' },
  { id: 'W3', title: 'Transcript-based proposal', short: 'Call to proposal', description: 'Turn client conversations into a sourced, technically complete proposal.', formats: ['PPTX', 'DOCX', 'PDF'], icon: 'file', required: ['Client name', 'Transcript or recording', 'Word template for detailed output'], category: 'Propose' },
  { id: 'W4', title: 'RFP response', short: 'RFP response', description: 'Answer the buyer’s requirements in their order, with a traceable compliance matrix.', formats: ['DOCX', 'PDF', 'PPTX'], icon: 'clipboard', required: ['RFP and annexures', 'Submission deadline', 'Buyer format or approved templates'], category: 'Propose' },
  { id: 'W5', title: 'RFI clarification questions', short: 'Clarifications', description: 'Ask only what remains unanswered. Separate the buyer’s sheet from the internal tracker.', formats: ['XLSX'], icon: 'message', required: ['All client documents', 'Explicit question cap', 'Buyer template when required', 'Question deadline if applicable'], category: 'Propose' },
  { id: 'W6', title: 'Demo build', short: 'Build a demo', description: 'Build a domain-faithful demo with sub-agent specifications and real acceptance tests.', formats: ['Demo', 'Test log'], icon: 'code', required: ['Target process', 'Domain process evidence', 'Approved domain process map'], category: 'Demonstrate' },
  { id: 'W7', title: 'Demo video', short: 'Demo walkthrough', description: 'Produce a branded walkthrough with the build platform kept out of view.', formats: ['Video'], icon: 'video', required: ['Working demo', 'Run sheet', 'Approved voice and recording tools'], category: 'Demonstrate' },
  { id: 'W8', title: 'Email draft', short: 'Email draft', description: 'A calm, sourced email in Zora’s magenta identity, ready for a human to review.', formats: ['HTML', 'Text'], icon: 'mail', required: ['Purpose', 'Recipient'], category: 'Communicate' },
] as const;

export type WorkflowId = typeof workflows[number]['id'];
export const workflowIds = workflows.map(w => w.id);
export const roles = ['consultant', 'bid_owner', 'architect', 'delivery_lead', 'pricing_owner', 'domain_owner', 'demo_builder', 'admin'] as const;
export type Role = typeof roles[number];
export type CaseStatus = 'awaiting_confirmation' | 'queued' | 'running' | 'awaiting_approval' | 'blocked' | 'released';
export interface CaseRecord {
  id: string; client: string; title: string; workflow: WorkflowId;
  status: CaseStatus; version: number; sourceRevision: number; qcPolicy:{cleanLoops:number|null;maxLoops:number|null}; stageIndex: number; source: 'manual' | 'email';
  createdAt: string; updatedAt: string; requestedBy: string; briefing: string;
}

export const statusLabels: Record<CaseStatus, string> = {
  awaiting_confirmation: 'Confirm workflow', queued: 'Queued for Zora', running: 'Zora working',
  awaiting_approval: 'Human review', blocked: 'Needs input', released: 'Released',
};
