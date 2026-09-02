# Roles & permissions

Roles live in the `Role` collection and are editable by a Super Admin
(**Roles** page). The six **system roles** below are seeded with the default
permission grants and cannot be deleted. `SUPER_ADMIN` implicitly has every
permission regardless of its stored list.

## Permission catalogue

| Group | Permissions |
|---|---|
| Requests | `request.create` `request.view` `request.edit` `request.delete` `request.assign` `request.forward` `request.close` `request.status_change` |
| Documents | `document.upload` `document.view` `document.download` `document.delete` |
| Remarks | `remark.add` |
| Masters / config | `department.manage` `location.manage` `category.manage` `status.manage` `settings.manage` |
| People | `user.manage` `role.manage` |
| Insight | `report.view` `audit.view` `dashboard.view` |
| Notifications | `notification.view` |

## Default grants

| Permission | SUPER_ADMIN | ADMIN | MLA | DEPT_OFFICER | DATA_ENTRY | VIEWER |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| request.create | ✓ | ✓ | ✓ | | ✓ | |
| request.view | ✓ | ✓ | ✓ | ✓ (own dept) | ✓ | ✓ |
| request.edit | ✓ | ✓ | | | ✓ (draft) | |
| request.delete | ✓ | ✓ | | | | |
| request.assign | ✓ | ✓ | | | | |
| request.forward | ✓ | ✓ | ✓ | ✓ | | |
| request.close | ✓ | ✓ | ✓ | | | |
| request.status_change | ✓ | ✓ | ✓ | ✓ | | |
| document.upload | ✓ | ✓ | | ✓ | ✓ | |
| document.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| document.download | ✓ | ✓ | ✓ | ✓ | | |
| document.delete | ✓ | ✓ | | | | |
| remark.add | ✓ | ✓ | ✓ | ✓ | | |
| department.manage | ✓ | ✓ | | | | |
| location.manage | ✓ | ✓ | | | | |
| category.manage | ✓ | ✓ | | | | |
| status.manage | ✓ | ✓ | | | | |
| settings.manage | ✓ | | | | | |
| user.manage | ✓ | ✓ | | | | |
| role.manage | ✓ | | | | | |
| report.view | ✓ | ✓ | ✓ | | | ✓ |
| audit.view | ✓ | ✓ | | | | |
| dashboard.view | ✓ | ✓ | ✓ | ✓ | | ✓ |
| notification.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Scoping beyond permissions

**Department Officers** only ever see requests where their department is the primary or
secondary department, or where they are the assigned officer. This is enforced server-side
in `requests.service.buildListFilter` and `dashboard` aggregation `scope()` — a permission
alone does not widen the data set.

Officers must be linked to a department (`departmentId`) — the user API rejects a
`DEPARTMENT_OFFICER` without one.
