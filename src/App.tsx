import { Routes, Route, Navigate, useLocation } from 'react-router';
import { motion, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { Shell } from './components/Shell';
import { CoinDrawer } from './components/CoinDrawer';
import { Overview } from './pages/Overview';
import { Markets } from './pages/Markets';
import { News } from './pages/News';
import { Watchlist } from './pages/Watchlist';
export function App() {
  const location = useLocation();
  useEffect(() => {
    const names: Record<string, string> = {
      '/': 'Overview',
      '/markets': 'Markets',
      '/news': 'News',
      '/watchlist': 'Watchlist',
    };
    document.title = `${names[location.pathname] ?? 'Overview'} — CryptoPulse`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  return (
    <MotionConfig reducedMotion="user">
      <Shell>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
        >
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/news" element={<News />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </Shell>
      <CoinDrawer />
    </MotionConfig>
  );
}
