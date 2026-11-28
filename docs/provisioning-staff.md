# Provisioning admin and office-staff accounts

Public sign-up always creates a **resident**. Admin and office-staff accounts are created manually by a project maintainer. To do this, set `app_metadata` when the user is created, because the public sign-up endpoint cannot set this field.

| `app_metadata` key | Value |
|---|---|
| `cc_role` | `admin` or `office_staff` |
| `cc_office_id` | Required for `office_staff`; the `offices.id` (e.g., `2` for BFP in the seed data) |

The `handle_new_user` trigger reads these keys and creates the profile. An office-staff account without an office is rejected (constraint `profiles_office_staff_has_office`).

> Creating a user with the Supabase Dashboard's "Add user" button fails, because it sets no `app_metadata`. The trigger then treats the user as a resident who has given no consent and rejects the insert. Use one of the methods below.

## Option A: Admin API (recommended for the hosted demo)
Run this from a trusted machine with the **service role key**. Never put that key in the browser app or in Git.

```ts
await supabaseAdmin.auth.admin.createUser({
  email: 'mdrrmo.staff@example.test',
  password: '<set a strong password>',
  email_confirm: true,
  user_metadata: { display_name: 'MDRRMO Duty Officer' },
  app_metadata: { cc_role: 'office_staff', cc_office_id: '1' },
})
```

## Option B: SQL editor (local development)
Follow the pattern in `supabase/seed.sql`: insert into `auth.users` (with `raw_app_meta_data`) and `auth.identities`.

## Changing a role later
Roles cannot be changed through the API, by anyone. This is enforced by column privileges and the `guard_profile_update` trigger. Use the SQL editor as the `postgres` role, for example:

```sql
update public.profiles set role = 'office_staff', office_id = 3 where id = '<user uuid>';
```
