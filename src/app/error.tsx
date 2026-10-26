'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main style={{maxWidth:480,margin:'15vh auto',padding:24,textAlign:'center'}}><h1>Something went wrong</h1><p>We couldn’t load this page. Please try again.</p><button onClick={reset} className="primary">Try again</button></main>;
}
