import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Servers from './pages/Servers'
import Resources from './pages/Resources'
import ServerDetail from './pages/ServerDetail'
import ResourceDetail from './pages/ResourceDetail'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/servers/:id" element={<ServerDetail />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:name" element={<ResourceDetail />} />
      </Routes>
    </Layout>
  )
}

export default App
