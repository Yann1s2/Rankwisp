-- Explicit linking preserves existing account IDs, data, and legacy sessions.
CREATE TABLE apple_identities(subject_key TEXT PRIMARY KEY,user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE apple_link_requests(request_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,subject_key TEXT NOT NULL,grant_token TEXT NOT NULL,native_ticket TEXT,platform TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX apple_link_expiry ON apple_link_requests(expires);
CREATE TABLE session_providers(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,provider TEXT NOT NULL CHECK(provider IN ('google','apple')));
