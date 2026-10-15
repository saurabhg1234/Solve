export function Orb({size='medium',pulse=false,tone='portal'}:{size?:'small'|'medium'|'large';pulse?:boolean;tone?:'portal'|'email'}) {
  return <span className={`orb orb-${size}${tone==='email'?' orb-email':''}${pulse?' orb-pulse':''}`} aria-label={tone==='email'?'Zora magenta orb':'Zora blue orb'}><span className="orb-core"/><span className="orb-orbit"/></span>;
}
