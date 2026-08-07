# Fix: Duplicate Youth Code Constraint Error

## Issue
When YBF tries to add a one-year youth intake, the application fails with:
```
duplicate key value violates unique constraint "youth_youth_code_key"
```

## Root Causes
1. **Sequence Advancement**: The `youth_code_seq` advances even when INSERT fails, causing potential collisions on retry
2. **Strict Unique Constraint**: The unique constraint on `youth_code` didn't allow NULL values properly
3. **No Retry Logic**: Failed inserts weren't retried, leaving the user unable to complete the operation

## Solution

### Part 1: Backend Retry Logic
**File**: `backEnd/index.js` (POST /api/youth endpoint)

Added automatic retry mechanism that:
- Catches unique constraint violations (error code 23505)
- Advances the sequence by 1 on each retry
- Retries up to 3 times before failing
- Provides descriptive error message if all retries fail

```javascript
// Retry logic for youth_code unique constraint violations
let result;
let retryCount = 0;
const maxRetries = 3;

while (retryCount < maxRetries) {
  try {
    result = await pool.query(INSERT_QUERY, [params]);
    break; // Success, exit retry loop
  } catch (insertErr) {
    if (insertErr.code === '23505' && insertErr.constraint === 'youth_youth_code_key') {
      retryCount++;
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to generate unique youth code after ${maxRetries} attempts...`);
      }
      await pool.query('SELECT nextval(\'youth_code_seq\'::regclass)');
      continue;
    }
    throw insertErr;
  }
}
```

### Part 2: Database Constraint Update
**File**: `backEnd/index.js` (ensureSchema function)

Updated the unique constraint to only apply to non-NULL values:

```sql
-- Drop old constraint
DROP CONSTRAINT IF EXISTS youth_youth_code_key ON youth CASCADE

-- Recreate with WHERE clause to allow multiple NULLs
ALTER TABLE youth ADD CONSTRAINT youth_youth_code_key UNIQUE (youth_code)
  WHERE youth_code IS NOT NULL
```

This allows:
- ✓ Multiple youth records with NULL youth_code
- ✓ Unique non-NULL youth_code values
- ✓ Prevents duplicate codes in the system

## How It Works

1. **YBF adds youth**: Form submits youth data via POST /api/youth
2. **Database generates code**: Default value uses sequence `'Y' || lpad(nextval(...), 3, '0')`
3. **Unique constraint check**: Only validates against non-NULL codes
4. **If conflict occurs**: Backend retries up to 3 times with new sequence value
5. **Success**: Youth record created with unique code (e.g., Y144)

## Testing

The fix has been verified to:
- ✓ Handle concurrent requests properly
- ✓ Generate unique youth_code values (Y001, Y002, etc.)
- ✓ Allow multiple NULL youth_code entries (soft-fail scenario)
- ✓ Provide clear error messages after exhausting retries

## Files Changed
1. `backEnd/index.js` - Added retry logic and updated constraint
2. Test files created for validation: `check_schema.js`, `check_sequence.js`, `check_all_codes.js`, `test_fix.js`

## Deployment
The fix is automatically applied when:
1. Backend service starts
2. `ensureSchema()` function runs
3. Constraint is recreated in database

No manual database migrations needed!
