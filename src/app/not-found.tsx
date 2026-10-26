import Link from 'next/link';
export default function NotFound() {
  return <main style={{maxWidth:480,margin:'15vh auto',padding:24,textAlign:'center'}}><h1>This page wandered off</h1><p>Head back to your people and ideas.</p><Link href="/">Back to Gather</Link></main>;
}
