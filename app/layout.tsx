import type { Metadata } from 'next';
import './globals.css';

export const metadata:Metadata={title:'Zora · Mindmap Digital',description:'The Mindmap Digital solutions workspace. Built around evidence, independent review, and human decisions.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
