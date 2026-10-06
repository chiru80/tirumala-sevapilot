import React from 'react';
import { ProfilesPage } from '../components/profiles/ProfilesPage';

export { ProfilesPage } from '../components/profiles/ProfilesPage';
export { ProfileCard } from '../components/profiles/ProfileCard';
export { ProfileCreateModal } from '../components/profiles/ProfileCreateModal';
export { PilgrimEditorModal, maskIdDisplay, INDIAN_STATES } from '../components/profiles/PilgrimEditor';
export { QuickPilgrimForm } from '../components/profiles/QuickPilgrimForm';
export { GeneralDetailsSection } from '../components/profiles/GeneralDetailsSection';
export { TravelChecklist } from '../components/profiles/TravelChecklist';

export function Profiles() {
  return <ProfilesPage />;
}
