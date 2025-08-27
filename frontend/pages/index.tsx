import Link from 'next/link'

export default function Home() {
return (
<div style={{ padding: 20 }}>
<h1>Park & Ride</h1>
<p>
<Link href="/login">▶ Login</Link>
</p>
<p>
<Link href="/register">▶ Sign Up</Link>
</p>
</div>
)
}