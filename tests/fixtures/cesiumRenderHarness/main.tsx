import { createRoot } from 'react-dom/client';
import { CesiumPremiumCanvas, type CesiumPremiumTheme } from '../../../src/components/Map/CesiumPremiumCanvas';

declare global {
  interface Window {
    __cesiumHarness: { error: string | null; mounted: boolean };
  }
}

window.__cesiumHarness = { error: null, mounted: false };

const params = new URLSearchParams(window.location.search);
const theme = (params.get('theme') as CesiumPremiumTheme | null) ?? 'satellite-3d';

function Harness() {
  return (
    <div style={{ width: '800px', height: '600px' }}>
      <CesiumPremiumCanvas
        theme={theme}
        userLocation={{ lat: 50.11, lng: 8.68 }}
        heading={0}
        isCourseUp={false}
        chargingStations={[]}
        onError={(message) => {
          window.__cesiumHarness.error = message;
        }}
      />
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root fehlt im Render-Harness');
createRoot(container).render(<Harness />);
window.__cesiumHarness.mounted = true;
