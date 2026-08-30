import {
    assertEcVslDashboardIngressV90,
    ecVslDashboardIngressV90Files,
    EC_VSL_DASHBOARD_INGRESS_V90_OVERRIDE_KEY
} from './ecVslDashboardIngressV90Service.js';

const readiness = await assertEcVslDashboardIngressV90();
const activeOverrides = new Set(globalThis[EC_VSL_DASHBOARD_INGRESS_V90_OVERRIDE_KEY] || []);
const missingOverrides = ecVslDashboardIngressV90Files.modifiedParentProtectedFiles
    .filter((relativePath) => !activeOverrides.has(relativePath));
if (readiness.ready !== true || readiness.dashboardPersistenceWithoutAutomation !== true || missingOverrides.length) {
    throw new Error(`[EC-VSL-DASHBOARD-V90] runtime_guard_blocked:${missingOverrides.join(',') || 'readiness'}`);
}
