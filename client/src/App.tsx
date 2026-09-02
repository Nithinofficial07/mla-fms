import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { ProtectedRoute, PublicOnly, RequirePermission } from '@/routes/guards';
import { PERMISSIONS } from '@mla/shared';

import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage';
import { SetupWizardPage } from '@/features/setup/SetupWizardPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { RequestListPage } from '@/features/requests/RequestListPage';
import { RequestCreatePage } from '@/features/requests/RequestCreatePage';
import { RequestDetailPage } from '@/features/requests/RequestDetailPage';
import { FileResolvePage } from '@/features/requests/FileResolvePage';
import { LetterListPage } from '@/features/letters/LetterListPage';
import { LetterCreatePage } from '@/features/letters/LetterCreatePage';
import { LetterDetailPage } from '@/features/letters/LetterDetailPage';
import { DepartmentsPage } from '@/features/departments/DepartmentsPage';
import { ImportPage } from '@/features/imports/ImportPage';
import {
  AreaTypesPage, WardsPage, GramPanchayatsPage, VillagesPage, SubVillagesPage,
} from '@/features/locations/LocationPages';
import {
  CategoriesPage, StatusesPage, PrioritiesPage, LookupsPage,
} from '@/features/config/ConfigPages';
import { UsersPage } from '@/features/users/UsersPage';
import { RolesPage } from '@/features/users/RolesPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { AuditLogPage } from '@/features/audit/AuditLogPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { ForbiddenPage, NotFoundPage } from '@/features/misc/ErrorPages';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      <Route path="/reset-password" element={<PublicOnly><ResetPasswordPage /></PublicOnly>} />
      <Route path="/setup" element={<SetupWizardPage />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/403" element={<ForbiddenPage />} />

      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<RequirePermission permission={PERMISSIONS.DASHBOARD_VIEW}><DashboardPage /></RequirePermission>} />
        <Route path="f/:token" element={<FileResolvePage />} />

        <Route path="requests">
          <Route index element={<RequirePermission permission={PERMISSIONS.REQUEST_VIEW}><RequestListPage /></RequirePermission>} />
          <Route path="new" element={<RequirePermission permission={PERMISSIONS.REQUEST_CREATE}><RequestCreatePage /></RequirePermission>} />
          <Route path=":id" element={<RequirePermission permission={PERMISSIONS.REQUEST_VIEW}><RequestDetailPage /></RequirePermission>} />
        </Route>

        <Route path="letters">
          <Route index element={<RequirePermission permission={PERMISSIONS.LETTER_VIEW}><LetterListPage /></RequirePermission>} />
          <Route path="new" element={<RequirePermission permission={PERMISSIONS.LETTER_CREATE}><LetterCreatePage /></RequirePermission>} />
          <Route path=":id" element={<RequirePermission permission={PERMISSIONS.LETTER_VIEW}><LetterDetailPage /></RequirePermission>} />
        </Route>

        <Route path="departments">
          <Route index element={<DepartmentsPage />} />
          <Route path="import" element={<RequirePermission permission={PERMISSIONS.DEPARTMENT_MANAGE}><ImportPage kind="DEPARTMENT" /></RequirePermission>} />
        </Route>

        <Route path="locations">
          <Route path="area-types" element={<RequirePermission permission={PERMISSIONS.LOCATION_MANAGE}><AreaTypesPage /></RequirePermission>} />
          <Route path="wards" element={<RequirePermission permission={PERMISSIONS.LOCATION_MANAGE}><WardsPage /></RequirePermission>} />
          <Route path="gram-panchayats" element={<RequirePermission permission={PERMISSIONS.LOCATION_MANAGE}><GramPanchayatsPage /></RequirePermission>} />
          <Route path="villages" element={<RequirePermission permission={PERMISSIONS.LOCATION_MANAGE}><VillagesPage /></RequirePermission>} />
          <Route path="sub-villages" element={<RequirePermission permission={PERMISSIONS.LOCATION_MANAGE}><SubVillagesPage /></RequirePermission>} />
          <Route path="import" element={<RequirePermission permission={PERMISSIONS.LOCATION_MANAGE}><ImportPage kind="LOCATION" /></RequirePermission>} />
        </Route>

        <Route path="config">
          <Route path="categories" element={<RequirePermission permission={PERMISSIONS.CATEGORY_MANAGE}><CategoriesPage /></RequirePermission>} />
          <Route path="statuses" element={<RequirePermission permission={PERMISSIONS.STATUS_MANAGE}><StatusesPage /></RequirePermission>} />
          <Route path="priorities" element={<RequirePermission permission={PERMISSIONS.STATUS_MANAGE}><PrioritiesPage /></RequirePermission>} />
          <Route path="lookups" element={<RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}><LookupsPage /></RequirePermission>} />
        </Route>

        <Route path="users" element={<RequirePermission permission={PERMISSIONS.USER_MANAGE}><UsersPage /></RequirePermission>} />
        <Route path="roles" element={<RequirePermission permission={PERMISSIONS.ROLE_MANAGE}><RolesPage /></RequirePermission>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<RequirePermission permission={PERMISSIONS.REPORT_VIEW}><ReportsPage /></RequirePermission>} />
        <Route path="audit" element={<RequirePermission permission={PERMISSIONS.AUDIT_VIEW}><AuditLogPage /></RequirePermission>} />
        <Route path="settings" element={<RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}><SettingsPage /></RequirePermission>} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
