import { useStore } from './store';
import type { SeedUser } from '../domain/permissions';

export function useCurrentUser(): SeedUser {
  const users = useStore((s) => s.users);
  const id = useStore((s) => s.currentUserId);
  return users.find((u) => u.id === id) || users[0];
}
