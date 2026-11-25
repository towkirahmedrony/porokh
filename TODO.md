# Profile redesign outcomes

- [ ] Compact profile/account hub: top bar with Bengali profile title and settings icon; 72px avatar/initial fallback; populated-only subtitle; XP and streak pills; avatar/completion tap opens edit; no standalone edit button.
- [ ] Completion behavior: calculate completion from name, gender, date of birth, guardian number, address, institution, class, group, batch, board, and goal; show progress and completion link; hide card at 100%; never render the old repeated empty-value copy.
- [ ] Plan and grouped navigation: compact plan card with plan name, today’s usage, conditional expiry, and upgrade action; groups for income/offers, account, and help; remove the confusing settings row from the account list; preserve all existing destinations.
- [ ] Account interactions: language row switches bn/en, dark-mode toggle uses existing theme preference, logout is a separate outlined danger action with confirmation, app version remains visible, and bottom-nav safe-area padding is preserved.
- [ ] Edit profile: retain the dedicated `/edit-profile` page with Personal and Academic sections, labeled inputs, phone/date controls, verified read-only email behavior where available, existing update-profile API, sticky save action, and unsaved-change warning.
- [ ] Resilience and visual quality: profile loading skeleton, friendly load-error retry, 8px spacing rhythm, 16px page padding, 48px rows, 12px cards, semantic theme tokens only, Bengali line-height >= 1.4, and light/dark mode support.
- [ ] Verification: build passes; relevant tests/typecheck pass; native sync is run when the project’s platform files require it; summarize changed files.
