import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ReturnToWariatkowoPage } from './pages/ReturnToWariatkowoPage';
import { WelcomePage } from './pages/WelcomePage';
import { TasksPage } from './pages/TasksPage';
import { ShoppingPage } from './pages/ShoppingPage';

export function App() {
  return (
    <Routes>
      <Route element={<WelcomePage />} path="/" />
      <Route element={<AppShell />}>
        <Route element={<DashboardPage />} path="/dashboard" />
        <Route element={<ReturnToWariatkowoPage />} path="/powrot-do-wariatkowa" />
        <Route element={<TasksPage />} path="/zadania" />
        <Route element={<ShoppingPage />} path="/zakupy" />
        <Route element={<Navigate replace to="/dashboard" />} path="*" />
      </Route>
    </Routes>
  );
}
