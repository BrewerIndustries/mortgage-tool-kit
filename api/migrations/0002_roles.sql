-- Add a role to users. 'admin' can manage other users; 'user' is a normal account.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
