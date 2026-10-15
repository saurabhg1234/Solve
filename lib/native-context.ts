/**
 * The genuine platform-issued identity of this agent session. Codex supplies CODEX_THREAD_ID;
 * a Claude Code cloud session supplies CLAUDE_CODE_REMOTE_SESSION_ID. Never user-supplied or invented.
 */
export function nativeContext(env:Record<string,string|undefined>=process.env):string|undefined{
  if(env.CODEX_THREAD_ID)return env.CODEX_THREAD_ID;
  if(env.CLAUDE_CODE_REMOTE_SESSION_ID)return `claude:${env.CLAUDE_CODE_REMOTE_SESSION_ID}`;
  return undefined;
}
