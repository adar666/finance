import '@testing-library/jest-dom/vitest'

// Deterministic date-fns (startOfMonth / endOfMonth use local TZ)
process.env.TZ = 'UTC'
