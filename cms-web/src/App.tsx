import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Shell } from './components/Shell';
import { DevicesPage } from './pages/DevicesPage';
import { LocationsPage } from './pages/LocationsPage';
import { LoginPage } from './pages/LoginPage';
import { MediaPage } from './pages/MediaPage';
import { PlaylistsPage } from './pages/PlaylistsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route index element={<Navigate to="/media" replace />} />
            <Route path="/media"     element={<MediaPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/devices"   element={<DevicesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
