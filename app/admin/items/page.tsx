import { getItems } from '@/app/actions/items';
import { ItemsClient } from './client-page';
import { PageShell } from '@/components/layout/page-header';

export default async function AdminItemsPage() {
  const items = await getItems();
  return (
    <PageShell>
      <ItemsClient items={items} />
    </PageShell>
  );
}
