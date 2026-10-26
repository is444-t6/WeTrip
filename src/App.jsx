import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import FamilyHome from './features/family/FamilyHome'
import DevLogin from './features/family/DevLogin'
import ChildDetail from './features/family/ChildDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/family" replace />} />
        <Route path="/family" element={<FamilyHome />} />
        <Route path="/family/dev-login" element={<DevLogin />} />
        <Route path="/family/child/:familyLinkId" element={<ChildDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
