import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNamecardName, shouldShowNameSkeleton } from './namecard';

test('the namecard prefers the profile name, then username, then auth metadata', () => {
  assert.equal(
    resolveNamecardName({
      fullName: 'Rahim Uddin',
      username: 'rahim',
      metadataName: 'Metadata',
    }),
    'Rahim Uddin'
  );

  assert.equal(
    resolveNamecardName({ fullName: '  ', username: 'rahim', metadataName: 'Metadata' }),
    'rahim'
  );

  assert.equal(
    resolveNamecardName({ fullName: null, username: undefined, metadataName: 'Metadata' }),
    'Metadata'
  );

  assert.equal(resolveNamecardName({}), null);
});

test('a known name is never replaced by the loading skeleton', () => {
  // Initial paint without any name yet: skeleton is expected.
  assert.equal(shouldShowNameSkeleton(null, true), true);

  // Profile enrichment / token refresh while the session name is known: the
  // card must keep rendering the name (this is the flicker regression guard).
  assert.equal(shouldShowNameSkeleton('Rahim Uddin', true), false);

  // Loading finished.
  assert.equal(shouldShowNameSkeleton('Rahim Uddin', false), false);
  assert.equal(shouldShowNameSkeleton(null, false), false);
});
