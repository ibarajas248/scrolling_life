(function () {
  const scriptUrl = document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src)
    : new URL('assets/scripts/maintenance-gate.js', window.location.href);
  const siteRoot = new URL('../../', scriptUrl);
  const statusUrl = new URL('site-status.json', siteRoot);
  const maintenanceUrl = new URL('mantenimiento/', siteRoot);
  const params = new URLSearchParams(window.location.search);
  const bypassMaintenance = params.get('preview') === '1';
  const normalizedCurrent = window.location.pathname.replace(/\/index\.html$/, '/');
  const normalizedMaintenance = maintenanceUrl.pathname.replace(/\/index\.html$/, '/');
  const isMaintenancePage = normalizedCurrent === normalizedMaintenance;

  statusUrl.searchParams.set('ts', Date.now().toString());

  fetch(statusUrl, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('status unavailable');
      return response.json();
    })
    .then((status) => {
      const maintenanceActive = status && status.maintenance === true;

      if (maintenanceActive && !isMaintenancePage && !bypassMaintenance) {
        const target = new URL(maintenanceUrl);
        target.searchParams.set('from', window.location.pathname);
        window.location.replace(target);
      }

      if (!maintenanceActive && isMaintenancePage) {
        window.location.replace(siteRoot);
      }
    })
    .catch(() => {
      if (isMaintenancePage) {
        return;
      }
    });
}());
