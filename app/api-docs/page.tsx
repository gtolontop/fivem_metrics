'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Check, Zap, Server, Package, Users, Clock, Code, ExternalLink } from 'lucide-react'

interface EndpointProps {
  method: string
  path: string
  description: string
  params?: { name: string; type: string; description: string; required?: boolean }[]
  response: string
  example: string
  liveTest?: boolean
}

function Endpoint({ method, path, description, params, response, example, liveTest }: EndpointProps) {
  const [copied, setCopied] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const runTest = async () => {
    setTesting(true)
    try {
      const res = await fetch(path.replace('{name}', 'es_extended').replace('{id}', 'qpez35'))
      const data = await res.json()
      setTestResult(JSON.stringify(data, null, 2).slice(0, 500) + (JSON.stringify(data).length > 500 ? '...' : ''))
    } catch (e) {
      setTestResult(`Error: ${e}`)
    }
    setTesting(false)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-2 py-1 rounded text-xs font-mono font-semibold ${
          method === 'GET' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
        }`}>
          {method}
        </span>
        <code className="font-mono text-lg">{path}</code>
      </div>

      <p className="text-muted mb-4">{description}</p>

      {params && params.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Parameters</h4>
          <div className="bg-bg rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {params.map(p => (
                  <tr key={p.name}>
                    <td className="py-1 font-mono text-accent">
                      {p.name}
                      {p.required && <span className="text-red-400 ml-1">*</span>}
                    </td>
                    <td className="py-1 text-muted">{p.type}</td>
                    <td className="py-1">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">Response</h4>
        <div className="bg-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre>{response}</pre>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Example</h4>
          <button
            onClick={() => copyToClipboard(example)}
            className="flex items-center gap-1 text-xs text-muted hover:text-white transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="bg-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-green-400">{example}</pre>
        </div>
      </div>

      {liveTest && (
        <div>
          <button
            onClick={runTest}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
          >
            <Zap size={16} />
            {testing ? 'Testing...' : 'Try it live'}
          </button>
          {testResult && (
            <div className="mt-4 bg-bg rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-48">
              <pre>{testResult}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
        <ArrowLeft size={18} /> Back
      </Link>

      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-semibold mb-4">Public API</h1>
        <p className="text-muted text-lg mb-6">
          Free, real-time access to FiveM server and resource metrics. No API key required.
        </p>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Zap className="mx-auto mb-2 text-yellow-400" size={24} />
            <p className="text-sm font-medium">No API Key</p>
            <p className="text-xs text-muted">Free access</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Clock className="mx-auto mb-2 text-green-400" size={24} />
            <p className="text-sm font-medium">Real-time</p>
            <p className="text-xs text-muted">SSE streaming</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Server className="mx-auto mb-2 text-blue-400" size={24} />
            <p className="text-sm font-medium">30k+ Servers</p>
            <p className="text-xs text-muted">Continuously scanned</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Package className="mx-auto mb-2 text-purple-400" size={24} />
            <p className="text-sm font-medium">800k+ Resources</p>
            <p className="text-xs text-muted">Indexed & searchable</p>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Clock size={18} />
            Rate Limits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted">REST Endpoints</p>
              <p className="font-mono text-lg">100 requests/minute</p>
            </div>
            <div>
              <p className="text-muted">SSE Streaming</p>
              <p className="font-mono text-lg">5 connections/IP</p>
            </div>
          </div>
        </div>
      </div>

      {/* Base URL */}
      <div className="bg-bg rounded-xl p-4 mb-8">
        <p className="text-sm text-muted mb-1">Base URL</p>
        <code className="text-lg font-mono">https://fivemmetrics-production.up.railway.app/api</code>
      </div>

      {/* Endpoints */}
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <Code size={24} />
        Endpoints
      </h2>

      {/* Resources */}
      <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
        <Package size={20} className="text-purple-400" />
        Resources
      </h3>

      <Endpoint
        method="GET"
        path="/api/resources/search"
        description="Search and list resources with pagination. Returns resources sorted by server count."
        params={[
          { name: 'q', type: 'string', description: 'Search query (optional)' },
          { name: 'limit', type: 'number', description: 'Results per page (default: 50, max: 100)' },
          { name: 'offset', type: 'number', description: 'Skip first N results (for pagination)' }
        ]}
        response={`{
  "resources": [
    {
      "name": "es_extended",
      "servers": 12500,
      "onlineServers": 8200,
      "players": 45000
    }
  ],
  "total": 800000,
  "hasMore": true
}`}
        example="curl 'https://fivemmetrics-production.up.railway.app/api/resources/search?q=esx&limit=10'"
        liveTest
      />

      <Endpoint
        method="GET"
        path="/api/resource/{name}"
        description="Get detailed information about a specific resource including servers currently using it."
        params={[
          { name: 'name', type: 'string', description: 'Resource name (URL encoded)', required: true }
        ]}
        response={`{
  "name": "es_extended",
  "servers": [...],
  "serverCount": 12500,
  "onlineServers": 8200,
  "totalPlayers": 45000,
  "prefix": "es_",
  "relatedResources": [...],
  "scanProgress": 100
}`}
        example="curl 'https://fivemmetrics-production.up.railway.app/api/resource/es_extended'"
        liveTest
      />

      {/* Servers */}
      <h3 className="text-xl font-medium mb-4 mt-8 flex items-center gap-2">
        <Server size={20} className="text-blue-400" />
        Servers
      </h3>

      <Endpoint
        method="GET"
        path="/api/servers"
        description="List servers with pagination and search. Returns servers sorted by player count."
        params={[
          { name: 'q', type: 'string', description: 'Search query (name, gametype, tags)' },
          { name: 'limit', type: 'number', description: 'Results per page (default: 50, max: 100)' },
          { name: 'offset', type: 'number', description: 'Skip first N results' }
        ]}
        response={`{
  "servers": [
    {
      "id": "qpez35",
      "name": "My RP Server",
      "players": 120,
      "maxPlayers": 256,
      "gametype": "Roleplay",
      "mapname": "Los Santos",
      "tags": "rp,esx"
    }
  ],
  "total": 32000,
  "hasMore": true
}`}
        example="curl 'https://fivemmetrics-production.up.railway.app/api/servers?q=roleplay&limit=20'"
        liveTest
      />

      <Endpoint
        method="GET"
        path="/api/server/{id}"
        description="Get detailed information about a specific server."
        params={[
          { name: 'id', type: 'string', description: 'Server CFX ID or IP:port', required: true }
        ]}
        response={`{
  "id": "qpez35",
  "name": "My RP Server",
  "players": 120,
  "maxPlayers": 256,
  "gametype": "Roleplay",
  "mapname": "Los Santos",
  "resources": ["es_extended", "esx_vehicleshop", ...],
  "vars": {"sv_projectName": "My Server", ...}
}`}
        example="curl 'https://fivemmetrics-production.up.railway.app/api/server/qpez35'"
        liveTest
      />

      {/* Stats */}
      <h3 className="text-xl font-medium mb-4 mt-8 flex items-center gap-2">
        <Users size={20} className="text-green-400" />
        Statistics
      </h3>

      <Endpoint
        method="GET"
        path="/api/queue/stats"
        description="Get current scan statistics and queue status."
        response={`{
  "pendingIpFetch": 0,
  "pendingScan": 1500,
  "totalServers": 32000,
  "totalWithIp": 32000,
  "totalOnline": 18000,
  "totalOffline": 12000,
  "totalUnavailable": 2000,
  "processing": 0
}`}
        example="curl 'https://fivemmetrics-production.up.railway.app/api/queue/stats'"
        liveTest
      />

      {/* Real-time Streaming */}
      <h2 className="text-2xl font-semibold mb-6 mt-12 flex items-center gap-2">
        <Zap size={24} className="text-yellow-400" />
        Real-time Streaming (SSE)
      </h2>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 rounded text-xs font-mono font-semibold bg-yellow-500/20 text-yellow-400">
            SSE
          </span>
          <code className="font-mono text-lg">/api/stats/stream</code>
        </div>

        <p className="text-muted mb-4">
          Server-Sent Events stream for real-time updates. Receives stats every 2 seconds and top 100 resources every 10 seconds.
        </p>

        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Message Types</h4>
          <div className="bg-bg rounded-lg p-4 font-mono text-sm space-y-4">
            <div>
              <p className="text-muted mb-1">// Stats (every 2s)</p>
              <pre>{`{
  "type": "stats",
  "totalResources": 800000,
  "serversOnline": 18000,
  "totalServers": 32000,
  "ipProgress": 100,
  "scanProgress": 95
}`}</pre>
            </div>
            <div>
              <p className="text-muted mb-1">// Resources (every 10s)</p>
              <pre>{`{
  "type": "resources",
  "resources": [...top 100...],
  "totalResources": 800000
}`}</pre>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">JavaScript Example</h4>
          <div className="bg-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-green-400">{`const eventSource = new EventSource('/api/stats/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'stats') {
    console.log('Online servers:', data.serversOnline);
  }

  if (data.type === 'resources') {
    console.log('Top resource:', data.resources[0]?.name);
  }
};

eventSource.onerror = () => {
  console.log('Reconnecting...');
};`}</pre>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <h2 className="text-2xl font-semibold mb-6 mt-12 flex items-center gap-2">
        <Code size={24} />
        Code Examples
      </h2>

      {/* Python */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="font-medium mb-4">Python</h3>
        <div className="bg-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-green-400">{`import requests

# Search for ESX resources
response = requests.get('https://fivemmetrics-production.up.railway.app/api/resources/search', params={
    'q': 'esx',
    'limit': 10
})

data = response.json()
for resource in data['resources']:
    print(f"{resource['name']}: {resource['servers']} servers")

# Get specific resource details
response = requests.get('https://fivemmetrics-production.up.railway.app/api/resource/es_extended')
resource = response.json()
print(f"Servers using es_extended: {resource['serverCount']}")`}</pre>
        </div>
      </div>

      {/* Node.js */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="font-medium mb-4">Node.js</h3>
        <div className="bg-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-green-400">{`// Search resources
const response = await fetch('https://fivemmetrics-production.up.railway.app/api/resources/search?q=esx&limit=10');
const data = await response.json();

console.log(\`Found \${data.total} resources\`);
data.resources.forEach(r => {
  console.log(\`\${r.name}: \${r.servers} servers, \${r.players} players\`);
});

// SSE streaming
import EventSource from 'eventsource';

const es = new EventSource('https://fivemmetrics-production.up.railway.app/api/stats/stream');
es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(\`Online: \${data.serversOnline} servers\`);
};`}</pre>
        </div>
      </div>

      {/* cURL */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="font-medium mb-4">cURL</h3>
        <div className="bg-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-green-400">{`# Search resources
curl 'https://fivemmetrics-production.up.railway.app/api/resources/search?q=qb-core&limit=5'

# Get resource details
curl 'https://fivemmetrics-production.up.railway.app/api/resource/qb-core'

# Get server list
curl 'https://fivemmetrics-production.up.railway.app/api/servers?limit=10'

# Stream real-time updates
curl -N 'https://fivemmetrics-production.up.railway.app/api/stats/stream'`}</pre>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-border text-center text-muted">
        <p className="mb-4">Questions or issues? Open an issue on GitHub.</p>
        <div className="flex justify-center gap-4">
          <Link href="/" className="text-accent hover:underline">
            Back to Dashboard
          </Link>
          <Link href="/resources" className="text-accent hover:underline">
            Browse Resources
          </Link>
          <Link href="/servers" className="text-accent hover:underline">
            Browse Servers
          </Link>
        </div>
      </div>
    </div>
  )
}
