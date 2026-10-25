CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    apartment_number VARCHAR(20) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'resident',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    caller_id INTEGER NOT NULL REFERENCES users(id),
    callee_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ringing',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    service VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    extra JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);