# 🐱 Whiskers & Haven — Cat Adoption Center

A full-stack feline adoption platform built with **Node.js**, **Express 5**, and a file-based database. Visitors can browse adoptable cats, submit adoption applications, create accounts, and track their requests — all while shelter staff manage listings and applications through a dedicated admin dashboard.

## Features

### For Visitors
- Browse cats with search and filter (age group, gender, status)
- View detailed cat profiles with health info, temperament tags, and photos
- Submit adoption applications (as a guest or logged-in user)
- Register with email OTP verification
- Track adoption request status from your account
- Dark mode (follows OS preference)
- Responsive design across all devices

### For Shelter Staff (Admin Dashboard)
- Secure JWT-protected admin panel
- CRUD management for cat profiles
- Inline status updates (Available / Pending / Adopted)
- Image upload for cat photos
- Adoption application review with status management
- Shelter statistics (totals, availability, applications)

## Tech Stack

| Layer          | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| **Runtime**    | Node.js                                                     |
| **Framework**  | Express 5                                                   |
| **Database**   | JSON file-based with atomic disk persistence                |
| **Auth**       | JWT + bcryptjs                                              |
| **Email OTP**  | Bird Verify API (dev mock mode built-in)                    |
| **Security**   | Helmet, CORS, rate limiting, input validation               |
| **Frontend**   | Vanilla HTML / CSS / JavaScript                             |
| **Icons**      | Font Awesome 6                                              |
| **Fonts**      | Fredoka, Plus Jakarta Sans                                  |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/your-username/whiskers-haven.git
cd whiskers-haven
npm install
```

### Configuration

Copy the environment template and fill in the values:

```bash
cp .env.example .env
```

Edit `.env`:

| Variable          | Required | Default     | Description                                        |
| ----------------- | -------- | ----------- | -------------------------------------------------- |
| `JWT_SECRET`      | Yes      | —           | Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ADMIN_USERNAME`  | First run | `admin`    | Initial admin username                             |
| `ADMIN_PASSWORD`  | First run | —          | Initial admin password                            |
| `BIRD_API_KEY`    | No       | (empty)     | Leave empty for dev mock mode                     |
| `PORT`            | No       | `3000`      | Server port                                        |

> **Dev mock mode**: When `BIRD_API_KEY` is empty, OTP codes are printed to the server console instead of being emailed.

### Run

```bash
npm start
```

Visit **http://localhost:3000** to browse cats, adopt, and register.

Visit **http://localhost:3000/admin** to access the admin dashboard.

### Seed Data

On first run, the app automatically populates 4 cats and 1 admin account (from environment variables). Delete `db/whiskers_db.json` to re-seed.

## API Overview

### Cats

| Method   | Endpoint              | Auth   | Description                |
| -------- | --------------------- | ------ | -------------------------- |
| `GET`    | `/api/cats`           | Public | List all cats              |
| `GET`    | `/api/cats/:id`       | Public | Get cat by ID              |
| `POST`   | `/api/cats`           | Admin  | Create cat                 |
| `PUT`    | `/api/cats/:id`       | Admin  | Update cat                 |
| `DELETE` | `/api/cats/:id`       | Admin  | Delete cat                 |
| `PATCH`  | `/api/cats/:id/status`| Admin  | Update adoption status     |

### Adoption

| Method   | Endpoint        | Auth            | Description                       |
| -------- | --------------- | --------------- | --------------------------------- |
| `POST`   | `/api/adopt`    | Public or User  | Submit adoption application       |

### Auth

| Method   | Endpoint                          | Auth   | Description                     |
| -------- | --------------------------------- | ------ | ------------------------------- |
| `POST`   | `/api/auth/register/send-otp`     | Public | Send OTP for registration       |
| `POST`   | `/api/auth/register/verify`       | Public | Verify OTP and create account   |
| `POST`   | `/api/auth/login`                 | Public | User login                      |
| `POST`   | `/api/auth/logout`                | Public | User logout                     |
| `GET`    | `/api/auth/me`                    | User   | Current user session            |
| `GET`    | `/api/auth/applications`          | User   | User's adoption applications    |

### Admin

| Method   | Endpoint                           | Auth   | Description                       |
| -------- | ---------------------------------- | ------ | --------------------------------- |
| `POST`   | `/api/admin/login`                 | Public | Admin login                       |
| `POST`   | `/api/admin/logout`                | Public | Admin logout                      |
| `GET`    | `/api/admin/me`                    | Admin  | Current admin session             |
| `GET`    | `/api/admin/stats`                 | Admin  | Shelter statistics                |
| `GET`    | `/api/admin/applications`          | Admin  | All adoption applications         |
| `PUT`    | `/api/admin/applications/:id`      | Admin  | Update application status         |

### Contact

| Method   | Endpoint         | Auth   | Description              |
| -------- | ---------------- | ------ | ------------------------ |
| `POST`   | `/api/contact`   | Public | Submit contact inquiry   |

## Project Structure

```
├── server.js              # Express entry point
├── .env.example           # Environment variable template
├── package.json
│
├── db/
│   ├── database.js        # JSON file-based database engine
│   └── whiskers_db.json   # Persistent data store
│
├── middleware/
│   └── auth.js            # JWT verification middleware
│
├── routes/
│   ├── admin.js           # Admin auth, stats, application management
│   ├── applications.js    # Adoption application submission
│   ├── auth.js            # User registration, login, session
│   └── cats.js            # Cat CRUD, search, image upload
│
├── services/
│   └── birdVerify.js      # Bird Verify API + dev mock OTP mode
│
└── public/
    ├── index.html         # Landing page
    ├── login.html         # User login / register
    ├── admin.html         # Admin dashboard
    ├── about.html         # About Us
    ├── contact.html       # Contact form
    ├── css/style.css
    ├── js/
    │   ├── app.js
    │   ├── auth.js
    │   └── admin.js
    └── uploads/           # Cat profile images
```

## Security

- **JWT authentication** with separate tiers for admins and users
- **bcrypt** password hashing (12 rounds)
- **Rate limiting** on login, OTP, and adoption endpoints
- **Input validation & sanitization** via `express-validator`
- **HTTP-only cookies** with `SameSite: Strict`
- **XSS prevention** via `escapeHtml()` on all dynamic content
- **Multer** file-type validation on image uploads
- **Helmet** for security headers

## License

MIT
