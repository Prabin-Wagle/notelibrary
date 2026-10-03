const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedNoteRecord {
  page: number;
  iv: string;
  ciphertext: string;
  updatedAt: string;
  algorithm: 'AES-GCM';
  version: 1;
}

interface EncryptedNoteStore {
  version: 1;
  documentId: string;
  notes: EncryptedNoteRecord[];
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const createKey = async (ownerScope: string, documentId: string) => {
  const seed = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`note-library:${ownerScope}:${documentId}:local-notes-v1`),
  );

  return crypto.subtle.importKey('raw', seed, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
};

const encryptRecord = async (
  page: number,
  value: string,
  key: CryptoKey,
): Promise<EncryptedNoteRecord> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value),
  );

  return {
    page,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString(),
    algorithm: 'AES-GCM',
    version: 1,
  };
};

export const loadEncryptedNotes = async (
  storageKey: string,
  ownerScope: string,
  documentId: string,
) => {
  const value = localStorage.getItem(storageKey);
  if (!value) return {} as Record<number, string>;

  try {
    const store = JSON.parse(value) as EncryptedNoteStore;
    if (store.version !== 1 || store.documentId !== documentId || !Array.isArray(store.notes)) {
      return {} as Record<number, string>;
    }

    const key = await createKey(ownerScope, documentId);
    const entries = await Promise.all(
      store.notes.map(async (record) => {
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: base64ToBytes(record.iv) },
          key,
          base64ToBytes(record.ciphertext),
        );
        return [record.page, decoder.decode(decrypted)] as const;
      }),
    );

    return Object.fromEntries(entries) as Record<number, string>;
  } catch {
    return {} as Record<number, string>;
  }
};

export const saveEncryptedNotes = async (
  storageKey: string,
  notes: Record<number, string>,
  ownerScope: string,
  documentId: string,
) => {
  const key = await createKey(ownerScope, documentId);
  const records = await Promise.all(
    Object.entries(notes)
      .filter(([, value]) => value.trim().length > 0)
      .map(([page, value]) => encryptRecord(Number(page), value, key)),
  );

  const store: EncryptedNoteStore = {
    version: 1,
    documentId,
    notes: records,
  };

  localStorage.setItem(storageKey, JSON.stringify(store));
};
