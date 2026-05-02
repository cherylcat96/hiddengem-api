# HiddenGem — API

Node.js/Express REST API for HiddenGem, a community-powered app for discovering and sharing hidden local spots.

**Live API:** https://hiddengem-api-production.up.railway.app

---

## Tech Stack

- Node.js / Express
- PostgreSQL (via pg)
- JWT authentication
- Bcrypt password hashing
- Cloudinary (photo storage)
- SendGrid (email verification)
- Deployed on Railway

---

## Database Schema

7 tables: user, gem, photo, tag, comment, save, follow

Primary key convention: tableNameID (e.g. userID, gemID)

---

## API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Register a new user |
| POST | /auth/login | Sign in, returns JWT |
| GET | /auth/verify-email?token= | Verify email address |

### Gems

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /gems | List gems (filter by category, tag, sort) |
| GET | /gems/:id | Get gem detail |
| POST | /gems | Create gem (auth required) |
| PATCH | /gems/:id | Update gem (owner only) |
| DELETE | /gems/:id | Delete gem (owner only) |
| POST | /gems/:id/flag | Flag a gem (auth required) |

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /gems/:id/comments | Get comments for a gem |
| POST | /gems/:id/comments | Post a comment (auth required) |

### Saves

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /gems/:id/saves | Save a gem (auth required) |
| DELETE | /gems/:id/saves | Unsave a gem (auth required) |
| GET | /users/me/saves | Get current user's saved gems |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users/:username | Get user profile |
| PATCH | /users/me | Update own profile (auth required) |
| GET | /users/:username/gems | Get gems by user |
| GET | /users/:username/followers | Get follower list |
| GET | /users/:username/following | Get following list |
| POST | /users/:username/follow | Follow a user (auth required) |
| DELETE | /users/:username/follow | Unfollow a user (auth required) |

---

## Authentication

Protected routes require a JWT in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are issued on login and registration. All accounts must verify their email before signing in.

---

## Local Development

```bash
git clone https://github.com/cherylcat96/hiddengem-api
cd hiddengem-api
npm install
cp .env.example .env
npm start
```

Runs on http://localhost:3001

### Environment Variables

```
DATABASE_URL=postgresql_connection_string
JWT_SECRET=jwt_secret
CLOUDINARY_CLOUD_NAME=cloudinary_cloud_name
CLOUDINARY_API_KEY=cloudinary_api_key
CLOUDINARY_API_SECRET=cloudinary_api_secret
SENDGRID_API_KEY=sendgrid_api_key
SENDGRID_FROM_EMAIL=verified_sender_email
```

---

## Known Limitations

- **Moderation** — POST /gems/:id/flag sets is_flagged = true in the database and flagged gems are excluded from all public queries. A moderation admin UI is not implemented and is scoped as a future feature.
- **Community page** — The follow/unfollow social graph is fully implemented. A dedicated /community browse page is scoped as a future feature.

---

## Related

- Frontend Repository: https://github.com/cherylcat96/hiddengem-ui
- Live App: https://hiddengem-ui.vercel.app
