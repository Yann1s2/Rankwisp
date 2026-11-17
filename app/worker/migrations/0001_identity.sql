CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,google_sub TEXT UNIQUE NOT NULL,email TEXT UNIQUE NOT NULL,created INTEGER NOT NULL,platform TEXT NOT NULL DEFAULT 'web');
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS oauth_states(state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,return_to TEXT NOT NULL,native_ticket TEXT,platform TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS native_auth(ticket_hash TEXT PRIMARY KEY,challenge TEXT NOT NULL,platform TEXT NOT NULL,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'pending',expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS edge_limits(key TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL,updated INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE INDEX IF NOT EXISTS oauth_expiry ON oauth_states(expires);
CREATE INDEX IF NOT EXISTS native_expiry ON native_auth(expires);
