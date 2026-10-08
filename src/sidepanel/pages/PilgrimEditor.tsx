import React from 'react';
import type { Pilgrim } from '@shared/types';
import {
  PilgrimEditorModal,
  maskIdDisplay,
  INDIAN_STATES,
} from '../components/profiles/PilgrimEditor';

export { PilgrimEditorModal, maskIdDisplay, INDIAN_STATES };

export interface PilgrimEditorProps {
  initialPilgrim?: Partial<Pilgrim>;
  onSave: (pilgrim: Omit<Pilgrim, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

/**
 * Consolidated PilgrimEditor page component
 * Bridges directly to the unified PilgrimEditorModal implementation
 */
export function PilgrimEditor({ initialPilgrim, onSave, onCancel }: PilgrimEditorProps) {
  const dummyPilgrim: Pilgrim = {
    id: (initialPilgrim as Pilgrim)?.id || 'temp-pilgrim-id',
    firstName: initialPilgrim?.firstName || '',
    lastName: initialPilgrim?.lastName || '',
    fullName: initialPilgrim?.fullName || `${initialPilgrim?.firstName || ''} ${initialPilgrim?.lastName || ''}`.trim(),
    gender: initialPilgrim?.gender || ('' as any),
    age: initialPilgrim?.age,
    dateOfBirth: initialPilgrim?.dateOfBirth,
    idType: initialPilgrim?.idType || ('' as any),
    idNumber: initialPilgrim?.idNumber || '',
    mobile: initialPilgrim?.mobile,
    email: initialPilgrim?.email,
    address: initialPilgrim?.address,
    city: initialPilgrim?.city,
    state: initialPilgrim?.state,
    district: initialPilgrim?.district,
    pinCode: initialPilgrim?.pinCode,
    country: initialPilgrim?.country || '',
    photo: initialPilgrim?.photo,
    srivariSeva: initialPilgrim?.srivariSeva,
    createdAt: (initialPilgrim as Pilgrim)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <PilgrimEditorModal
      editPilgrim={{ profileId: 'default', pilgrim: dummyPilgrim }}
      onClose={onCancel}
      onSave={async (saved) => {
        const { id, createdAt, updatedAt, ...rest } = saved;
        onSave(rest);
      }}
    />
  );
}
