import { describe, it, expect } from 'vitest';
import { encryptForStorage, decryptFromStorage } from '../../src/security/crypto';
import { createBackup, restoreBackup } from '../../src/security/backup';
import { Gender, IdType } from '../../src/shared/types';
import type { Profile } from '../../src/shared/types';

describe('Web Crypto & Backup System', () => {
  it('should encrypt and decrypt a plaintext string correctly', async () => {
    const secret = 'Om Namo Venkatesaya - 7 Hills Tirumala';
    const password = 'StrongPassword123!@#';

    const { encrypted, salt, iv } = await encryptForStorage(secret, password);
    expect(encrypted).not.toBe(secret);
    expect(salt).toBeTruthy();
    expect(iv).toBeTruthy();

    const decrypted = await decryptFromStorage(encrypted, salt, iv, password);
    expect(decrypted).toBe(secret);
  });

  it('should fail decryption when given wrong password', async () => {
    const secret = 'Pilgrim Sensitive Aadhaar';
    const password = 'CorrectPassword123';

    const { encrypted, salt, iv } = await encryptForStorage(secret, password);
    await expect(
      decryptFromStorage(encrypted, salt, iv, 'WrongPassword456'),
    ).rejects.toThrow();
  });

  it('should create and restore an encrypted .spbk backup', async () => {
    const mockProfiles: Profile[] = [
      {
        id: 'prof-1',
        name: 'Family Pilgrimage',
        description: 'Tirumala annual trip',
        pilgrims: [
          {
            id: 'p-1',
            firstName: 'Srinivasan',
            lastName: 'Raman',
            fullName: 'Srinivasan Raman',
            gender: Gender.MALE,
            dateOfBirth: '1975-08-15',
            age: 50,
            idType: IdType.AADHAAR,
            idNumber: '998877665544',
            mobile: '9840123456',
            country: 'India',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
        selectedPilgrims: { darshan: ['p-1'] },
        isDefault: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];

    const password = 'VaultMasterKey999!';
    const backup = await createBackup(mockProfiles, password);

    expect(backup.format).toBe('SPBK');
    expect(backup.metadata.profileCount).toBe(1);
    expect(backup.metadata.pilgrimCount).toBe(1);

    const restored = await restoreBackup(backup, password);
    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe('Family Pilgrimage');
    expect(restored[0].pilgrims[0].fullName).toBe('Srinivasan Raman');
  });
});
