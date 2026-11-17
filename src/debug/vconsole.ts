// Production vConsole is opt-in only. It is a debugging tool, not app code,
// so it must not add a request or runtime cost to normal student sessions.
// Enable it with VITE_ENABLE_VCONSOLE=true for a specific deployment.
const enabled =
  !import.meta.env.DEV && import.meta.env.VITE_ENABLE_VCONSOLE === 'true';

if (enabled) {
  import('vconsole')
    .then(({ default: VConsole }) => {
      new VConsole();
    })
    .catch(() => {
      /* vConsole লোড না হলে অ্যাপ চলবে */
    });
}

export {};
