import { useState, useEffect, useCallback, useMemo } from 'react';
import { getProfiles, setDefaultProfile, updateSelectedPilgrims } from '@storage/repository';
import { ServiceType } from '@shared/types';
import type { Profile, Pilgrim } from '@shared/types';
import { calculateProfileHealth } from '../../services/profile-health';
import type { ProfileHealth } from '../../services/profile-health';

export interface UseProfilesResult {
  profiles: Profile[];
  activeProfile: Profile | null;
  loading: boolean;
  health: ProfileHealth;
  selectedPilgrims: Pilgrim[];
  selectedPilgrimIds: string[];
  switchProfile: (profileId: string) => Promise<void>;
  togglePilgrimSelection: (serviceType: ServiceType, pilgrimId: string) => Promise<void>;
  selectAllPilgrims: (serviceType: ServiceType) => Promise<void>;
  deselectAllPilgrims: (serviceType: ServiceType) => Promise<void>;
  reloadProfiles: () => Promise<void>;
}

export function useProfiles(currentService: ServiceType = ServiceType.DARSHAN): UseProfilesResult {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const reloadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getProfiles();
      setProfiles(list);
      const defaultProf = list.find(p => p.isDefault) ?? list[0] ?? null;
      setActiveProfile(prev => {
        if (!prev) return defaultProf;
        const updated = list.find(p => p.id === prev.id);
        return updated ?? defaultProf;
      });
    } catch {
      // storage not ready or mock environment
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadProfiles();
  }, [reloadProfiles]);

  const switchProfile = useCallback(async (profileId: string) => {
    const target = profiles.find(p => p.id === profileId);
    if (target) {
      setActiveProfile(target);
      await setDefaultProfile(profileId).catch(() => {});
    }
  }, [profiles]);

  // Compute profile health
  const health = useMemo(() => {
    return calculateProfileHealth(activeProfile);
  }, [activeProfile]);

  // Compute selected pilgrims for current service
  // Semantics:
  // undefined = service has never been configured (defaults to first min(6, all.length))
  // [] = user explicitly selected ZERO pilgrims (NEVER convert [] into all pilgrims)
  // [string IDs] = explicitly selected pilgrims (strictly capped at 6)
  const { selectedPilgrims, selectedPilgrimIds } = useMemo(() => {
    if (!activeProfile || !activeProfile.pilgrims || activeProfile.pilgrims.length === 0) {
      return { selectedPilgrims: [], selectedPilgrimIds: [] };
    }
    const all = activeProfile.pilgrims;
    const configured = activeProfile.selectedPilgrims?.[currentService];

    if (configured === undefined) {
      const defaultPilgrims = all.slice(0, 6);
      return {
        selectedPilgrims: defaultPilgrims,
        selectedPilgrimIds: defaultPilgrims.map(p => p.id),
      };
    }

    if (Array.isArray(configured)) {
      if (configured.length === 0) {
        return {
          selectedPilgrims: [],
          selectedPilgrimIds: [],
        };
      }
      const validPilgrims = all.filter(p => configured.includes(p.id)).slice(0, 6);
      return {
        selectedPilgrims: validPilgrims,
        selectedPilgrimIds: validPilgrims.map(p => p.id),
      };
    }

    return { selectedPilgrims: [], selectedPilgrimIds: [] };
  }, [activeProfile, currentService]);

  const togglePilgrimSelection = useCallback(async (serviceType: ServiceType, pilgrimId: string) => {
    if (!activeProfile) return;
    const configured = activeProfile.selectedPilgrims?.[serviceType];
    const currentList = configured !== undefined
      ? configured
      : activeProfile.pilgrims.slice(0, 6).map(p => p.id);

    let updatedList: string[];
    if (currentList.includes(pilgrimId)) {
      updatedList = currentList.filter(id => id !== pilgrimId);
    } else {
      // Strictly prevent selecting a seventh pilgrim (maximum 6)
      if (currentList.length >= 6) {
        return;
      }
      updatedList = [...currentList, pilgrimId];
    }

    const updatedProfile: Profile = {
      ...activeProfile,
      selectedPilgrims: {
        ...(activeProfile.selectedPilgrims || {}),
        [serviceType]: updatedList,
      },
      updatedAt: new Date().toISOString(),
    };

    setActiveProfile(updatedProfile);
    setProfiles(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
    await updateSelectedPilgrims(updatedProfile.id, serviceType, updatedList).catch(() => {});
  }, [activeProfile]);

  const selectAllPilgrims = useCallback(async (serviceType: ServiceType) => {
    if (!activeProfile) return;
    // Select All must select: Math.min(6, availablePilgrims.length)
    const cappedIds = activeProfile.pilgrims.slice(0, 6).map(p => p.id);
    const updatedProfile: Profile = {
      ...activeProfile,
      selectedPilgrims: {
        ...(activeProfile.selectedPilgrims || {}),
        [serviceType]: cappedIds,
      },
      updatedAt: new Date().toISOString(),
    };
    setActiveProfile(updatedProfile);
    setProfiles(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
    await updateSelectedPilgrims(updatedProfile.id, serviceType, cappedIds).catch(() => {});
  }, [activeProfile]);

  const deselectAllPilgrims = useCallback(async (serviceType: ServiceType) => {
    if (!activeProfile) return;
    const updatedProfile: Profile = {
      ...activeProfile,
      selectedPilgrims: {
        ...(activeProfile.selectedPilgrims || {}),
        [serviceType]: [],
      },
      updatedAt: new Date().toISOString(),
    };
    setActiveProfile(updatedProfile);
    setProfiles(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
    await updateSelectedPilgrims(updatedProfile.id, serviceType, []).catch(() => {});
  }, [activeProfile]);

  return {
    profiles,
    activeProfile,
    loading,
    health,
    selectedPilgrims,
    selectedPilgrimIds,
    switchProfile,
    togglePilgrimSelection,
    selectAllPilgrims,
    deselectAllPilgrims,
    reloadProfiles,
  };
}
