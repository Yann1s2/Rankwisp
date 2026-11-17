-- Separate transaction namespaces retain compatibility with existing Google deployments.
CREATE TABLE apple_oauth_states(state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,return_to TEXT NOT NULL,native_ticket TEXT,platform TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE apple_native_auth(ticket_hash TEXT PRIMARY KEY,challenge TEXT NOT NULL,platform TEXT NOT NULL,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'pending',expires INTEGER NOT NULL,completion_hash TEXT,handoff_ticket TEXT);
CREATE TABLE apple_grants(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,token TEXT NOT NULL);
CREATE INDEX apple_oauth_expiry ON apple_oauth_states(expires);
CREATE INDEX apple_native_expiry ON apple_native_auth(expires);
