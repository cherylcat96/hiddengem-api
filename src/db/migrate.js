const pool = require('./pool');

const sql = `
  CREATE TABLE IF NOT EXISTS "user" (
    "userID"       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username       VARCHAR(40)  UNIQUE NOT NULL,
    display_name   VARCHAR(80)  NOT NULL,
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(72)  NOT NULL,
    bio            TEXT,
    avatar_url     VARCHAR(500),
    is_verified    BOOLEAN      DEFAULT FALSE,
    created_at     TIMESTAMP    DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS gem (
    "gemID"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userID"        UUID REFERENCES "user"("userID") ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    description     TEXT         NOT NULL,
    category        VARCHAR(40)  NOT NULL,
    latitude        DECIMAL(9,6) NOT NULL,
    longitude       DECIMAL(9,6) NOT NULL,
    location_label  VARCHAR(200),
    privacy         VARCHAR(20)  DEFAULT 'public',
    view_count      INTEGER      DEFAULT 0,
    is_flagged      BOOLEAN      DEFAULT FALSE,
    created_at      TIMESTAMP    DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS photo (
    "photoID"      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "gemID"        UUID REFERENCES gem("gemID") ON DELETE CASCADE,
    url            VARCHAR(500) NOT NULL,
    display_order  INTEGER      DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tag (
    "tagID"   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "gemID"   UUID REFERENCES gem("gemID") ON DELETE CASCADE,
    name      VARCHAR(60) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comment (
    "commentID"  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "gemID"      UUID REFERENCES gem("gemID") ON DELETE CASCADE,
    "userID"     UUID REFERENCES "user"("userID") ON DELETE CASCADE,
    body         TEXT      NOT NULL,
    created_at   TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS save (
    "userID"   UUID REFERENCES "user"("userID") ON DELETE CASCADE,
    "gemID"    UUID REFERENCES gem("gemID")     ON DELETE CASCADE,
    saved_at   TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY ("userID", "gemID")
  );

  CREATE TABLE IF NOT EXISTS follow (
    "followerID"  UUID REFERENCES "user"("userID") ON DELETE CASCADE,
    "followingID" UUID REFERENCES "user"("userID") ON DELETE CASCADE,
    created_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY ("followerID", "followingID")
  );
`;

async function migrate() {
  try {
    await pool.query(sql);
    console.log('✓ All tables created');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();