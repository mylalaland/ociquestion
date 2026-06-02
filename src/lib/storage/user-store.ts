import { UserProfile, COLORS_KR, ANIMALS_KR, ANIMAL_EMOJIS } from '../ai/types';

const STORAGE_KEY_USERS = 'LALA_QUIZ_USERS';
const STORAGE_KEY_ACTIVE = 'LALA_QUIZ_ACTIVE_USER';

function generateRandomName(): { name: string; avatar: string } {
  const colorIdx = Math.floor(Math.random() * COLORS_KR.length);
  const animalIdx = Math.floor(Math.random() * ANIMALS_KR.length);
  return {
    name: `${COLORS_KR[colorIdx]}${ANIMALS_KR[animalIdx]}`,
    avatar: ANIMAL_EMOJIS[animalIdx],
  };
}

export function getAllUsers(): UserProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY_USERS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getActiveUserId(): string {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem(STORAGE_KEY_ACTIVE) || 'default';
}

export function setActiveUserId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_ACTIVE, id);
}

export function createUser(customName?: string): UserProfile {
  const { name, avatar } = generateRandomName();
  const user: UserProfile = {
    id: 'user_' + Math.random().toString(36).substr(2, 8),
    name: customName || name,
    avatar,
    createdAt: new Date().toISOString(),
  };
  
  const users = getAllUsers();
  users.push(user);
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  return user;
}

export function updateUserName(userId: string, newName: string): void {
  const users = getAllUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx >= 0) {
    users[idx].name = newName;
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  }
}

export function deleteUser(userId: string): void {
  const users = getAllUsers().filter(u => u.id !== userId);
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  
  // Clean up user-specific data
  const keysToClean = Object.keys(localStorage).filter(k => k.includes(`_${userId}`));
  keysToClean.forEach(k => localStorage.removeItem(k));
  
  // Switch to default if deleted user was active
  if (getActiveUserId() === userId) {
    setActiveUserId(users.length > 0 ? users[0].id : 'default');
  }
}

export function ensureDefaultUser(): UserProfile {
  let users = getAllUsers();
  if (users.length === 0) {
    const user = createUser();
    setActiveUserId(user.id);
    return user;
  }
  return users.find(u => u.id === getActiveUserId()) || users[0];
}

// Get user-specific storage key
export function userKey(key: string, userId?: string): string {
  const uid = userId || getActiveUserId();
  return `${key}_${uid}`;
}
