# Quick Start Guide

## 🎯 What Changed

1. **Admin Access**: `test-user` now has admin privileges. The admin page is protected and no longer crashes when accessing tables.
2. **Team Creation**: New users create their own team with a custom name, selecting from available leagues (instead of picking pre-seeded teams).
3. **UI Improvements**: Better sidebar with team badge, improved auth modal, cleaner admin page.

## ✅ Already Done

- ✅ Database migration applied (`is_admin` column added)
- ✅ `test-user` promoted to admin
- ✅ Code built successfully
- ✅ All TypeScript errors resolved

## 🚀 To Test

### Start the app:
```bash
npm run dev
```

### Test Scenario 1: Create a new user
1. Go to http://localhost:3000
2. Click "Register"
3. Fill in details (any email, password, username, display name)
4. Click "Create Account"
5. See "Create Your Team" form
6. Pick a league from dropdown
7. Enter a team name (e.g., "My Awesome Team")
8. Click "Create Team" 🏐
9. You should be on the dashboard with your team name shown in the sidebar

### Test Scenario 2: Login as admin (test-user)
1. Login with test-user's credentials
2. You should see "Database Admin" link in the sidebar
3. Click it → see the admin panel
4. Click a table (e.g., "users") → data should load without errors
5. ✨ The `.map is not a function` bug is fixed!

### Test Scenario 3: Login as non-admin
1. Create a new account and complete team creation
2. Try visiting http://localhost:3000/admin directly
3. You should see "🔒 Access Denied" message
4. "Database Admin" link should NOT appear in sidebar

## 📝 Important Files

| File | Purpose |
|------|---------|
| `src/lib/db/index.ts` | Database initialization with `is_admin` migration |
| `src/lib/auth/requireAdmin.ts` | Protects admin API routes |
| `src/contexts/auth-context.tsx` | Auth state with `isAdmin` and team creation |
| `src/components/auth-modal.tsx` | New team creation form |
| `src/app/admin/page.tsx` | Admin page with security gate and bug fix |
| `scripts/init-db.js` | One-time script to add `is_admin` column and promote test-user |

## 🔄 Database Changes

One new column added to `users` table:
```sql
is_admin INTEGER DEFAULT 0
```

This is automatically added when the app first runs (migration in `src/lib/db/index.ts`).

## ❓ FAQ

**Q: test-user still doesn't have admin access?**
A: Run `node scripts/init-db.js` to ensure the column exists and test-user is promoted.

**Q: Admin page still crashes?**
A: Verify the build succeeded (`npm run build`). The fix checks `Array.isArray(data)` in two places.

**Q: New users can't see league dropdown?**
A: Ensure leagues were seeded. The demo seeds two leagues at startup. Check the database with `node tmp_check_users.js` to debug.

**Q: How do I make another user an admin?**
A: Edit `src/lib/db/schema.ts` or directly update the database:
```sql
UPDATE users SET is_admin = 1 WHERE username = 'someuser';
```

## 🎨 UI/UX Highlights

- **Sidebar**: Team name displayed in amber badge for easy identification
- **Auth Modal**: Clear distinction between login/register and team creation
- **Admin Page**: Friendly "Access Denied" message instead of blank page or crash
- **Loading States**: Spinner in buttons and "Creating..." text during async operations

---

**Ready to deploy?** Just run `npm run build && npm run start` 🚀
