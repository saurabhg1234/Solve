export function Orb({size='medium',pulse=false}:{size?:'small'|'medium'|'large';pulse?:boolean}) {
  return <span className={`orb orb-${size}${pulse?' orb-pulse':''}`} aria-label="Zora magenta orb"><span className="orb-core"/><span className="orb-orbit"/></span>;
}
