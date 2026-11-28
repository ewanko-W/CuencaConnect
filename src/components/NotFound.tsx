import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="content">
      <h1>Page not found</h1>
      <p>
        <Link to="/app">Go to the resident app</Link>
      </p>
    </main>
  )
}
