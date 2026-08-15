import { CreatePoolChooser } from 'poold';

// The sport-agnostic "create a pool" entry point (/admin/create). Presentational —
// only <Link>s + SportBadge, no data fetching — so it renders as-is under the provider's
// MemoryRouter. Full-page (min-h-screen).
export const Page = () => <CreatePoolChooser />;
