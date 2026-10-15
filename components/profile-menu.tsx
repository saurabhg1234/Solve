'use client';
import { useEffect,useRef,useState } from 'react';
import { ChevronDown,LogOut } from 'lucide-react';

type User={email:string;name:string;roles:string[]};
const roleLabel:Record<string,string>={admin:'Administrator',consultant:'Consultant',bid_owner:'Bid owner',pricing_owner:'Pricing owner',demo_builder:'Demo builder'};

/** Signed-in account menu: who you are, your Zora roles, and sign-out. */
export function ProfileMenu({user}:{user:User}){
  const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const close=(e:MouseEvent|KeyboardEvent)=>{if(e instanceof KeyboardEvent?e.key==='Escape':!ref.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener('mousedown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',close);};},[open]);
  return <div className="profile-menu" ref={ref}>
    <button className="profile-button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}><span className="user-avatar">{user.name.slice(0,1).toUpperCase()}</span><span className="profile-name">{user.name}</span><ChevronDown size={16}/></button>
    {open&&<div className="profile-dropdown" role="menu"><strong>{user.name}</strong><span>{user.email}</span><div className="profile-roles">{user.roles.map(r=><em key={r}>{roleLabel[r]||r}</em>)}</div>
      <button role="menuitem" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});window.location.reload();}}><LogOut size={16}/> Sign out</button></div>}
  </div>;
}
