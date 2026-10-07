// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PilgrimSelection } from '../../src/sidepanel/components/dashboard/PilgrimSelection';
import { Gender, IdType } from '../../src/shared/types';
import type { Pilgrim } from '../../src/shared/types';

const completePilgrim: Pilgrim = {
  id: 'p1',
  firstName: 'Srinivas',
  lastName: 'Rao',
  fullName: 'Srinivas Rao',
  age: 42,
  gender: Gender.MALE,
  idType: IdType.AADHAAR,
  idNumber: '123456789012',
  mobile: '9876543210',
  country: 'India',
  createdAt: new Date().toISOString(),
};

const incompletePilgrim: Pilgrim = {
  id: 'p2',
  firstName: 'Padma',
  lastName: 'Rao',
  fullName: 'Padma Rao',
  age: 38,
  gender: Gender.FEMALE,
  idType: IdType.AADHAAR,
  idNumber: '', // Missing ID
  mobile: '9876543210',
  country: 'India',
  createdAt: new Date().toISOString(),
};

describe('PilgrimSelection Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no pilgrims are present', () => {
    render(
      <PilgrimSelection
        pilgrims={[]}
        selectedIds={[]}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />
    );
    expect(screen.getByText(/No (devotees|pilgrims) in this profile yet\./i)).toBeTruthy();
  });

  it('renders devotee list with ready vs incomplete status', () => {
    render(
      <PilgrimSelection
        pilgrims={[completePilgrim, incompletePilgrim]}
        selectedIds={['p1']}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />
    );

    expect(screen.getByText('Srinivas Rao')).toBeTruthy();
    expect(screen.getByText('Padma Rao')).toBeTruthy();
    expect(screen.getByText('✓ Ready')).toBeTruthy();
    expect(screen.getByText(/⚠ (Needs attention|Missing ID)/i)).toBeTruthy();
    expect(screen.getByText(/SELECT PILGRIMS.*1.*of.*2/i)).toBeTruthy();
  });

  it('toggles selection for ready devotee', () => {
    const onToggle = vi.fn();
    render(
      <PilgrimSelection
        pilgrims={[completePilgrim]}
        selectedIds={['p1']}
        onToggle={onToggle}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />
    );

    const checkbox = screen.getByLabelText(/Srinivas Rao/);
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('p1');
  });

  it('prevents selecting incomplete devotee and displays warning', () => {
    const onToggle = vi.fn();
    render(
      <PilgrimSelection
        pilgrims={[incompletePilgrim]}
        selectedIds={[]}
        onToggle={onToggle}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />
    );

    const checkbox = screen.getByLabelText('Select Padma Rao');
    fireEvent.click(checkbox);

    // Should NOT toggle
    expect(onToggle).not.toHaveBeenCalled();
    // Warning should show
    expect(screen.getByText(/Cannot select "Padma Rao": Missing ID Number/)).toBeTruthy();
  });

  it('calls onSelectAll and onDeselectAll callbacks', () => {
    const onSelectAll = vi.fn();
    const onDeselectAll = vi.fn();

    render(
      <PilgrimSelection
        pilgrims={[completePilgrim]}
        selectedIds={[]}
        onToggle={vi.fn()}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^select all$/i }));
    expect(onSelectAll).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^deselect all$/i }));
    expect(onDeselectAll).toHaveBeenCalled();
  });

  it('strictly prevents selecting a seventh devotee when 6 are already selected', () => {
    const onToggle = vi.fn();
    const sixPilgrims: Pilgrim[] = Array.from({ length: 7 }, (_, i) => ({
      ...completePilgrim,
      id: `p${i + 1}`,
      fullName: `Devotee ${i + 1}`,
    }));

    render(
      <PilgrimSelection
        pilgrims={sixPilgrims}
        selectedIds={['p1', 'p2', 'p3', 'p4', 'p5', 'p6']}
        onToggle={onToggle}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />
    );

    // Try to toggle the 7th devotee (p7)
    const seventhCheckbox = screen.getByLabelText('Select Devotee 7');
    fireEvent.click(seventhCheckbox);

    // Should NOT allow toggle
    expect(onToggle).not.toHaveBeenCalled();
    // Maximum warning should show
    expect(screen.getByText(/Maximum 6 (devotees|pilgrims) allowed per booking/i)).toBeTruthy();
  });

  // ─── PHASE 5: PROFILES & PILGRIM MANAGER EXTENSIONS ───

  it('strictly enforces Homam exact 2 pilgrims limit and displays service badge', () => {
    const onToggle = vi.fn();
    const threePilgrims: Pilgrim[] = [
      { ...completePilgrim, id: 'p1', fullName: 'Devotee 1' },
      { ...completePilgrim, id: 'p2', fullName: 'Devotee 2' },
      { ...completePilgrim, id: 'p3', fullName: 'Devotee 3' },
    ];

    render(
      <PilgrimSelection
        pilgrims={threePilgrims}
        selectedIds={['p1', 'p2']}
        exactCount={2}
        onToggle={onToggle}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />
    );

    expect(screen.getByText(/Maximum 2 pilgrims per booking/i)).toBeTruthy();

    // Try to select a 3rd devotee when exact limit 2 is already selected
    const thirdCheckbox = screen.getByLabelText('Select Devotee 3');
    fireEvent.click(thirdCheckbox);

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByText(/Maximum 2 persons per booking/i)).toBeTruthy();
  });

  it('strictly enforces Srivari Seva exact 1 participant limit', () => {
    const onToggle = vi.fn();
    const twoPilgrims: Pilgrim[] = [
      { ...completePilgrim, id: 'p1', fullName: 'Sevak 1' },
      { ...completePilgrim, id: 'p2', fullName: 'Sevak 2' },
    ];

    render(
      <PilgrimSelection
        pilgrims={twoPilgrims}
        selectedIds={['p1']}
        exactCount={1}
        onToggle={onToggle}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />
    );

    expect(screen.getByText(/Maximum 1 participant per booking/i)).toBeTruthy();

    const secondCheckbox = screen.getByLabelText('Select Sevak 2');
    fireEvent.click(secondCheckbox);

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByText(/Maximum 1 persons per booking/i)).toBeTruthy();
  });

  it('renders visual slot indicators and tracks slot allocation', () => {
    render(
      <PilgrimSelection
        pilgrims={[completePilgrim]}
        selectedIds={['p1']}
        maxAllowed={6}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />
    );

    // Devotee row slot indicator
    expect(screen.getAllByText(/Slot 1/i)[0]).toBeTruthy();
    // Visual quota slots (Slot 1 to Slot 6)
    expect(screen.getByText('Slot 6')).toBeTruthy();
  });

  it('calls onEditPilgrim when clicking attention badge on incomplete devotee', () => {
    const onEditPilgrim = vi.fn();

    render(
      <PilgrimSelection
        pilgrims={[incompletePilgrim]}
        selectedIds={[]}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onEditPilgrim={onEditPilgrim}
      />
    );

    const attentionBadge = screen.getByText(/⚠ Needs attention/i);
    fireEvent.click(attentionBadge);

    expect(onEditPilgrim).toHaveBeenCalledWith(incompletePilgrim);
  });

  it('renders add devotee slot button when quota allows and calls onAddPilgrim', () => {
    const onAddPilgrim = vi.fn();

    render(
      <PilgrimSelection
        pilgrims={[completePilgrim]}
        selectedIds={['p1']}
        maxAllowed={6}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onAddPilgrim={onAddPilgrim}
      />
    );

    const addBtn = screen.getByText(/\+ Add Devotee \(Slot 2\)/i);
    expect(addBtn).toBeTruthy();

    fireEvent.click(addBtn);
    expect(onAddPilgrim).toHaveBeenCalledTimes(1);
  });
});

