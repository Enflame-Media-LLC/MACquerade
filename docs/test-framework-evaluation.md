# Test Framework Evaluation: Vitest vs Node Test Runner

**Issue:** SPF-9 - Evaluate and migrate test framework from tape to modern runner
**Date:** 2026-01-23
**Author:** Claude Code

## Executive Summary

After evaluating both Vitest and Node's built-in test runner, **Vitest is recommended** for the spoof project migration. The primary deciding factor is that Node's module mocking requires an experimental flag (`--experimental-test-module-mocks`), which creates stability concerns for production code.

## Current State

- **Framework:** tape ^5.9.0
- **Mocking:** esmock ^2.7.3
- **Coverage:** c8 ^10.1.3
- **Test Count:** 305 tests across 4 files
- **Coverage Threshold:** >80%

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| ESM Module Mocking | High | Critical for mocking child_process |
| Stability | High | No experimental flags in production |
| Migration Effort | Medium | How much code needs to change |
| Watch Mode | Medium | DX for local development |
| Coverage Integration | Medium | Must maintain >80% coverage |
| Dependencies | Low | Fewer is better, but not critical |

## Framework Comparison

### Vitest

**Version tested:** 4.0.18

#### Pros
- Mature, battle-tested API (Jest-compatible)
- No experimental flags required
- Built-in watch mode with HMR
- Built-in coverage via v8/c8
- Excellent IDE support (VS Code, WebStorm)
- Large ecosystem and community
- TypeScript support out of the box

#### Cons
- +1 dependency (vitest package + transitive deps)
- Requires config file (vitest.config.ts)
- Module mocking syntax requires understanding of hoisting

#### Mocking Pattern
```javascript
// vi.doMock (not hoisted) for per-test mocking
vi.resetModules()
vi.doMock('child_process', () => {
  const mock = { execSync: mockExecSync, exec: vi.fn() }
  return { default: mock, ...mock }
})
const spoof = await import('../../dist/index.js')
```

### Node Test Runner

**Version tested:** Node 22.x built-in

#### Pros
- Zero dependencies (built-in)
- Native ESM support
- TAP-compatible output
- Growing adoption

#### Cons
- **CRITICAL:** Module mocking requires `--experimental-test-module-mocks`
- Experimental features may change without notice
- Less mature ecosystem
- Fewer IDE integrations

#### Mocking Pattern
```javascript
const mock = t.mock.module('child_process', {
  defaultExport: { execSync: mockExecSync },
  namedExports: { execSync: mockExecSync }
})
const spoof = await import('../../dist/index.js')
mock.restore()
```

## Proof of Concept Results

Both frameworks successfully passed all POC tests:

| Test Suite | Vitest | Node |
|------------|--------|------|
| basic.test.js (20 tests) | PASS | PASS |
| findInterfaces.test.js (2 tests) | PASS | PASS |
| **Total** | **22/22** | **22/22** |

### Performance Comparison

| Metric | Vitest | Node |
|--------|--------|------|
| Basic tests duration | 563ms | 686ms |
| Mocked tests duration | 185ms | 58ms |
| Total test file duration | 1.07s | 0.86s |

Note: Node is slightly faster, but both are acceptable.

## Migration Effort Assessment

### API Mapping: tape → Vitest

| tape | Vitest |
|------|--------|
| `t.equal(a, b)` | `expect(a).toBe(b)` |
| `t.deepEqual(a, b)` | `expect(a).toEqual(b)` |
| `t.ok(value)` | `expect(value).toBeTruthy()` |
| `t.notEqual(a, b)` | `expect(a).not.toBe(b)` |
| `t.pass(msg)` | `expect(true).toBe(true)` or omit |
| `t.fail(msg)` | `expect.fail(msg)` or `throw` |
| `t.skip(reason)` | `it.skip(...)` |
| `t.doesNotThrow(fn)` | `expect(fn).not.toThrow()` |
| `t.end()` | Not needed (auto) |

### API Mapping: tape → Node Test Runner

| tape | Node |
|------|------|
| `t.equal(a, b)` | `assert.equal(a, b)` |
| `t.deepEqual(a, b)` | `assert.deepEqual(a, b)` |
| `t.ok(value)` | `assert.ok(value)` |
| `t.notEqual(a, b)` | `assert.notEqual(a, b)` |
| `t.pass(msg)` | No direct equivalent |
| `t.fail(msg)` | `assert.fail(msg)` |
| `t.skip(reason)` | `it.skip(...)` |
| `t.doesNotThrow(fn)` | `assert.doesNotThrow(fn)` |
| `t.end()` | Not needed (auto) |

### esmock → Vitest/Node Migration

The current esmock pattern:
```javascript
const spoof = await esmock('../dist/index.js', {
  'child_process': { execSync: mockExecSync }
})
```

Maps almost 1:1 to both frameworks with minor syntax changes.

## Risk Analysis

| Risk | Vitest | Node | Mitigation |
|------|--------|------|------------|
| Breaking changes | Low | Medium | Pin version, follow changelogs |
| Experimental API removal | N/A | High | Cannot mitigate - experimental flag |
| Module mocking edge cases | Low | Low | Both use similar ESM loader approach |
| CI compatibility | None | None | Both work on all platforms |

## Recommendation

**Choose: Vitest**

### Rationale

1. **Stability First:** The `--experimental-test-module-mocks` flag in Node is the primary disqualifier. Experimental features can change without notice, potentially breaking CI pipelines.

2. **Industry Standard:** Vitest/Jest-style testing is more widely adopted, making it easier for contributors to understand the test suite.

3. **Developer Experience:** Vitest's watch mode with HMR provides faster feedback during development.

4. **Future-Proof:** Vitest is actively maintained with a clear roadmap, while Node's test runner is still evolving.

### Trade-offs Accepted

- One additional dependency (vitest)
- Requires vitest.config.ts
- Slightly different syntax from tape (but more modern)

## Migration Plan

1. Install vitest
2. Create vitest.config.ts
3. Migrate test files one at a time:
   - basic.js → basic.test.ts
   - findInterfaces.test.js → findInterfaces.test.ts
   - setInterfaceMAC.test.js → setInterfaceMAC.test.ts
   - cli.test.js → cli.test.ts
4. Update package.json scripts
5. Remove tape and esmock dependencies
6. Verify all 305 tests pass
7. Verify coverage >80%
8. Add watch mode script

## Dependencies After Migration

**Added:**
- vitest

**Removed:**
- tape
- esmock

**Unchanged:**
- c8 (optional - vitest has built-in coverage, but c8 can remain for compatibility)
