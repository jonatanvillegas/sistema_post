import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import { Toaster } from 'react-hot-toast';
import AppRouter from './router';
import './index.css';

const theme = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  components: {
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
    },
    Table: {
      headerBg: '#fafafa',
    },
  },
};

export default function App() {
  console.log('📦 Componente App montado');
  return (
    <ConfigProvider theme={theme} locale={esES}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { borderRadius: '8px', fontFamily: 'Inter, sans-serif', fontSize: '14px' },
        }}
      />
      <AppRouter />
    </ConfigProvider>
  );
}
