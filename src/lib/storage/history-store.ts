import { QuizResult } from '../ai/types';

export interface QuizHistory {
  id: string;
  title: string;
  subject: string;
  date: string; // ISO string
  totalQuestions: number;
  correctAnswers: number;
  wrongQuestions: string[]; // ids of wrong questions
  quizResult: QuizResult;
  difficulty?: string;
  score?: number; // 100점 만점 기준 점수 또는 맞춘 개수 등
  isFinalized?: boolean; // 기록 고정 여부
  pointsEarned?: number; // 획득 포인트
}

const DB_NAME = 'OciQuizHistoryDB';
const STORE_NAME = 'history';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('subject', 'subject', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

export async function saveQuizHistory(history: QuizHistory): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(history);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllQuizHistory(): Promise<QuizHistory[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getHistoryById(id: string): Promise<QuizHistory | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteQuizHistory(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
