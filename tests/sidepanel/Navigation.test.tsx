// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Navigation } from '../../src/sidepanel/components/Navigation';
import { setLanguage, type Language } from '../../src/i18n/index';

describe('Navigation Component — Localization & Regression Suite', () => {
  beforeEach(() => {
    cleanup();
    setLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  const languageExpectations: Array<{
    lang: Language;
    home: string;
    profiles: string;
    more: string;
  }> = [
    { lang: 'en', home: 'Home', profiles: 'Profiles', more: 'More' },
    { lang: 'te', home: 'హోమ్', profiles: 'ప్రొఫైల్‌లు', more: 'మరిన్ని' },
    { lang: 'hi', home: 'होम', profiles: 'प्रोफ़ाइल', more: 'और' },
    { lang: 'ta', home: 'முகப்பு', profiles: 'சுயவிவரங்கள்', more: 'மேலும்' },
    { lang: 'kn', home: 'ಮುಖಪುಟ', profiles: 'ಪ್ರೊಫೈಲ್‌ಗಳು', more: 'ಇನ್ನಷ್ಟು' },
  ];

  for (const { lang, home, profiles, more } of languageExpectations) {
    it(`renders correctly localized navigation labels in ${lang} without raw keys`, () => {
      setLanguage(lang);
      const onNavigate = vi.fn();

      const { container } = render(
        <Navigation currentPage="dashboard" onNavigate={onNavigate} />
      );

      // Verify exact localized text rendered for all 3 tabs
      expect(screen.getByText(home)).toBeTruthy();
      expect(screen.getByText(profiles)).toBeTruthy();
      expect(screen.getByText(more)).toBeTruthy();

      // Regression: Hard check that raw key 'nav.more' never leaks to DOM
      expect(screen.queryByText('nav.more')).toBeNull();
      expect(screen.queryByText('nav.home')).toBeNull();
      expect(screen.queryByText('nav.profiles')).toBeNull();

      // Regression: No raw key patterns anywhere in textContent or aria-labels
      const rawKeyRegex = /\bnav\.[a-zA-Z0-9_]+\b/;
      expect(container.innerHTML).not.toMatch(rawKeyRegex);
    });
  }

  it('triggers onNavigate with "more" when More tab is clicked', () => {
    setLanguage('en');
    const onNavigate = vi.fn();
    render(<Navigation currentPage="dashboard" onNavigate={onNavigate} />);

    const moreBtn = screen.getByRole('button', { name: /More/i });
    fireEvent.click(moreBtn);

    expect(onNavigate).toHaveBeenCalledWith('more');
  });

  it('triggers onNavigate with "dashboard" and "profiles" when respective tabs are clicked', () => {
    setLanguage('en');
    const onNavigate = vi.fn();
    render(<Navigation currentPage="more" onNavigate={onNavigate} />);

    const homeBtn = screen.getByRole('button', { name: /Home/i });
    fireEvent.click(homeBtn);
    expect(onNavigate).toHaveBeenCalledWith('dashboard');

    const profilesBtn = screen.getByRole('button', { name: /Profiles/i });
    fireEvent.click(profilesBtn);
    expect(onNavigate).toHaveBeenCalledWith('profiles');
  });

  it('highlights the active navigation tab based on currentPage prop', () => {
    setLanguage('en');
    const { rerender } = render(<Navigation currentPage="dashboard" onNavigate={vi.fn()} />);
    let homeBtn = screen.getByRole('button', { name: /Home/i });
    expect(homeBtn.getAttribute('aria-current')).toBe('page');

    rerender(<Navigation currentPage="more" onNavigate={vi.fn()} />);
    let moreBtn = screen.getByRole('button', { name: /More/i });
    expect(moreBtn.getAttribute('aria-current')).toBe('page');
    expect(homeBtn.getAttribute('aria-current')).toBeNull();
  });
});
