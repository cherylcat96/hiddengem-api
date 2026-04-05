# HiddenGem — API Service

REST API and database layer for the HiddenGem community location-sharing platform.

## What is HiddenGem?

HiddenGem lets real people share the places that most people never find — a hidden waterfall trail, a rooftop garden, a decades-old café known only to locals. Users submit locations with photos and descriptions, and others discover them through an interactive map and card feed.

## What this repo is

This is the **Node.js/Express API** for HiddenGem. It sits between the React frontend and the PostgreSQL database and is the only process that reads from or writes to the database.

**Tech stack:**
- Node.js + Express
- PostgreSQL (hosted on Railway)
- Cloudinary — photo storage and CDN
- SendGrid — transactional email (verification)
- JWT — authentication
- Deployed on Railway

## How it fits into the overall application

```
[ hiddengem-ui: React ]  →  REST/JSON  →  [ This repo: Express API ]  →  [ PostgreSQL ]
                                                                       →  [ Cloudinary ]
                                                                       →  [ SendGrid ]
```

## API base URL

```
https://api.hiddengem.app/v1
```

All endpoints accept and return JSON. Authentication is JWT via `Authorization: Bearer <token>`.

## Endpoint groups (MVP)

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email`, `POST /auth/resend-verification` |
| Users | `GET /users/:username`, `PATCH /users/me` |
| Gems | `GET /gems`, `GET /gems/:id`, `POST /gems`, `PATCH /gems/:id`, `DELETE /gems/:id`, `POST /gems/:id/flag` |
| Photos | `POST /uploads/photo` |
| Comments | `GET /gems/:id/comments`, `POST /gems/:id/comments` |
| Saves | `POST /gems/:id/saves`, `DELETE /gems/:id/saves`, `GET /users/me/saves` |
| User gems | `GET /users/:username/gems` |

## Stretch feature

**Follow / Unfollow social graph** — `POST/DELETE /users/:username/follows`, `GET /users/:username/followers`, `GET /users/:username/following`, `GET /gems?feed=following`. Implemented after MVP is complete.

## Database

PostgreSQL with 7 tables (singular naming, `tableNameID` primary key convention):

`user` · `gem` · `photo` · `tag` · `comment` · `save` · `follow`

## Design documents

All API and database design documents are in the `/design` folder:

- `database_design.pdf` — Technology choice, ERD, table specifications with application context
- `service_layer.pdf` — All REST endpoints with sample requests, responses, and error cases
