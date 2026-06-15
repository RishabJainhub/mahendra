import { getLayouts } from '@/app/actions/layouts';
import { LayoutClient } from './LayoutClient';

export default async function AdminLayoutsPage() {
  const layouts = await getLayouts();
  return <LayoutClient layouts={layouts} />;
}
