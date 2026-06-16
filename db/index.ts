export function getDb() {
  throw new Error(
    "D1 is only available in the Sites deployment path. The Vercel build uses db/store.ts."
  );
}
