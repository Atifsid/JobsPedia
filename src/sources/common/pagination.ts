export interface PageResult<T> {
  items: T[];
  total: number;
}

/** Fetch every page of an offset/limit API until the reported total is reached. */
export async function paginate<T>(
  fetchPage: (offset: number) => Promise<PageResult<T>>,
  pageSize: number,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const { items, total } = await fetchPage(offset);
    if (items.length === 0) break;
    all.push(...items);
    offset += pageSize;
    if (all.length >= total) break;
  }
  return all;
}
