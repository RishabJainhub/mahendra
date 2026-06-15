import { getItems } from '@/app/actions/items';
import { ItemsClient } from './client-page';

export default async function AdminItemsPage() {
  const items = await getItems();
  return <ItemsClient items={items} />;
}
