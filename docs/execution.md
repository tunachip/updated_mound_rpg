# docs/execution.md

## Move Execution Procedure

Moves now resolve through typed intents instead of direct state mutation.

### Resolution Flow

1. Execute the next move step.
2. Convert the step into a typed intent.
3. Emit an attempt event from that intent.
4. Resolve interrupt listeners, allowing them to cancel or rewrite the current intent.
5. If the intent survives, commit it to combat state.
6. Emit committed events from the applied result.
7. Resolve side-effect listeners for those committed events.
8. Drain queued side-effect intents recursively through the same resolver.
9. Continue to the next move step unless the execution frame is marked `breakSequence`.

### Key Rules

- Interrupt listeners only modify or cancel the current pending intent.
- Side effects run only after a successful commit.
- Blessings that need a post-commit consequence, like exhausting themselves, enqueue a side-effect intent.
- Committed events are emitted from actual applied results, not the original proposed values.

### Example

```typescript
const result = executeMove(combat, caster, move, [target]);

if (result.breaks) {
  // stop the remaining steps in the current move sequence
}
```
