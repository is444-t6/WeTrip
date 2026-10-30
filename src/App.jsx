import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './features/family/Login'
import Home from './features/family/Home'
import MyAccounts from './features/family/MyAccounts'
import FamilyHome from './features/family/FamilyHome'
import ChildDetail from './features/family/ChildDetail'
import { isLoggedIn } from './features/family/session'

function Root() {
  return <Navigate to={isLoggedIn() ? '/home' : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />
        <Route path="/family/dev-login" element={<Navigate to="/login" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/accounts" element={<MyAccounts />} />
        <Route path="/family" element={<FamilyHome />} />
        <Route path="/family/child/:familyLinkId" element={<ChildDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
