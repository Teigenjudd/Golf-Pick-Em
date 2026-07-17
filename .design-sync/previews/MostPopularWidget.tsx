import { MostPopularWidget } from 'poold';
import { picks } from '../preview-data.js';

export const Default = () => (
  <div style={{ maxWidth: 300, padding: 8 }}>
    <MostPopularWidget picks={picks} />
  </div>
);
