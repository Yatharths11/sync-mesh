const Y = require('yjs');

/**
 * Week 3 — Yjs Convergence Tests (isolated, no networking)
 *
 * Goal: prove that two or more Y.Docs, edited completely independently
 * (simulating offline devices), always converge to IDENTICAL final state
 * once their updates are exchanged — regardless of order.
 *
 * Pattern for every test:
 *   1. Create N independent Y.Docs (simulating N offline devices)
 *   2. Apply local edits to each, independently
 *   3. Encode each doc's state as a binary update
 *   4. Cross-apply updates between docs (simulating sync)
 *   5. Assert all docs now have IDENTICAL text content
 */

describe('CRDT Convergence — Concurrent Inserts', () => {
  test('two concurrent inserts at the same position converge identically', () => {
    // WORKED EXAMPLE — study this pattern, you'll repeat it below.

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Both start from the same base state: "cat"
    docA.getText('content').insert(0, 'cat');
    // Sync the base state to B before anyone diverges
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    // Now they diverge — NEITHER has seen the other's edit yet
    docA.getText('content').insert(1, 'h'); // "chat"
    docB.getText('content').insert(1, 'o'); // "coat"

    // Simulate reconnect: exchange updates
    const updateFromA = Y.encodeStateAsUpdate(docA);
    const updateFromB = Y.encodeStateAsUpdate(docB);

    Y.applyUpdate(docB, updateFromA); // B learns about A's edit
    Y.applyUpdate(docA, updateFromB); // A learns about B's edit

    const finalA = docA.getText('content').toString();
    const finalB = docB.getText('content').toString();

    // The core claim: both replicas reach the SAME string.
    // We don't assert *which* string (e.g. "choat" vs "cohat") —
    // that's YATA's arbitrary-but-consistent tiebreak, not something
    // we should hardcode and couple our test to. We only assert
    // that both sides agree with each other.
    expect(finalA).toBe(finalB);
    // Both characters must survive — nothing was dropped.
    expect(finalA).toContain('h');
    expect(finalA).toContain('o');
  });
});

describe('CRDT Convergence — Concurrent Delete + Insert', () => {
  test('a delete on one replica and an insert near that spot on another converge identically', () => {
    // TODO: implement.
    //
    // Think about the setup carefully:
    // 1. Start both docs from the same base text (pick something with
    //    enough characters that a delete near the edge is meaningful,
    //    e.g. "hello").

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    docA.getText('content').insert(0, 'hello');

    // 2. Sync that base state.
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    expect(docB.getText('content').toString()).toBe('hello');

    // 3. On docA: DELETE a character.
    docA.getText('content').delete(4, 1);

    // 4. On docB (independently, hasn't seen A's delete): INSERT a
    //    character at or near the same index.
    docB.getText('content').insert(5, 'world');

    // 5. Cross-apply updates both ways.
    const updateFromA = Y.encodeStateAsUpdate(docA);
    const updateFromB = Y.encodeStateAsUpdate(docB);

    Y.applyUpdate(docB, updateFromA); // B learns about A's edit
    Y.applyUpdate(docA, updateFromB); // A learns about B's edit

    const finalA = docA.getText('content').toString();
    const finalB = docB.getText('content').toString();

    // 6. Assert docA and docB converge to the same final string.
    expect(finalA).toBe(finalB);
    // Question to answer for yourself before coding: what should
    // happen to B's inserted character if it was anchored right next
    // to the character A deleted? Should it survive? (Yes — figure out
    // why, based on tombstoning, before you write the assertion.)
    expect(finalA).toBe('hellworld');
  });
});

describe('CRDT Convergence — Out-of-Order Update Application', () => {
  test('applying a sequence of updates out of order still converges', () => {
    // TODO: implement.
    //
    // 1. On a single doc (docA), make THREE separate sequential edits,
    //    capturing a binary update after each one (you'll need
    //    Y.encodeStateAsUpdate at three different points — look at
    //    whether you want full-state snapshots or incremental diffs,
    //    and be ready to explain the difference if I ask).

    const docA = new Y.Doc();

    const sv0 = Y.encodeStateVector(docA);
    docA.getText('content').insert(0, 'cat');
    const op1 = Y.encodeStateAsUpdate(docA, sv0);

    const sv1 = Y.encodeStateVector(docA);
    docA.getText('content').insert(3, 'sit');
    const op2 = Y.encodeStateAsUpdate(docA, sv1);

    const sv2 = Y.encodeStateVector(docA);
    docA.getText('content').insert(6, 'table');
    const op3 = Y.encodeStateAsUpdate(docA, sv2);

    // 2. Create a fresh docB with no edits.
    const docB = new Y.Doc();

    // 3. Apply the THREE updates to docB in a scrambled order
    //    (e.g. op3, op1, op2).
    Y.applyUpdate(docB, op3);
    // op3's causal dependencies haven't arrived, so Yjs parks it in
    // pendingStructs instead of applying it. If op3 were a full-state
    // snapshot this would already read "catsittable".
    expect(docB.getText('content').toString()).toBe('');

    Y.applyUpdate(docB, op1);
    Y.applyUpdate(docB, op2); // op2's arrival unblocks the parked op3

    // 4. Assert docB's final content matches docA's final content.
    const finalA = docA.getText('content').toString();
    const finalB = docB.getText('content').toString();
    expect(finalA).toBe('catsittable');
    expect(finalB).toBe(finalA);
  });
});

describe('CRDT Convergence — Idempotency', () => {
  test('applying the same update twice does not corrupt state', () => {
    // TODO: implement.
    //
    // 1. docA makes an edit, encode the update.
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Both start from the same base state: "cat"
    docA.getText('content').insert(0, 'cat');
    const updateFromA = Y.encodeStateAsUpdate(docA);
    // 2. Apply it to docB ONCE, capture the resulting string.
    Y.applyUpdate(docB, updateFromA);
    const afterFirstApply = docB.getText('content').toString();

    // 3. Apply the SAME update to docB AGAIN.
    Y.applyUpdate(docB, updateFromA);
    const afterSecondApply = docB.getText('content').toString();
    // 4. Assert the string is unchanged after the second application —
    //    i.e. re-applying doesn't duplicate the inserted text.

    // The core claim: both replicas reach the SAME string.
    // We don't assert *which* string (e.g. "choat" vs "cohat") —
    // that's YATA's arbitrary-but-consistent tiebreak, not something
    // we should hardcode and couple our test to. We only assert
    // that both sides agree with each other.
    expect(afterFirstApply).toBe('cat');
    expect(afterSecondApply).toBe(afterFirstApply);

    // Why does this matter in a real system? Think about at-least-once
    // delivery over a flaky network or WebSocket reconnect — what
    // happens if the same update gets sent twice?
  });
});

describe('CRDT Convergence — Three-Way Divergence', () => {
  test('three independently-edited replicas converge regardless of merge order', () => {
    // TODO: implement.
    //
    // 1. Three docs (A, B, C) all start from the same synced base state.

    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const docC = new Y.Doc();

    docA.getText('content').insert(0, 'cat');
    const base = Y.encodeStateAsUpdate(docA);
    Y.applyUpdate(docB, base);
    Y.applyUpdate(docC, base);
    expect(docB.getText('content').toString()).toBe('cat');
    expect(docC.getText('content').toString()).toBe('cat');

    // 2. Each makes its OWN independent edit, having seen none of the
    //    others' edits.

		docA.getText('content').insert(0, 'bat');
		docB.getText('content').insert(0, 'book');
		docC.getText('content').insert(0, 'dog');
    // 3. Merge them in a DIFFERENT order into two separate "final" docs
    //    to prove order-independence, e.g.:
    //      - finalDoc1: apply A's update, then B's, then C's

		const finalDoc1 = new Y.Doc();
		Y.applyUpdate(finalDoc1, Y.encodeStateAsUpdate(docA));
		Y.applyUpdate(finalDoc1, Y.encodeStateAsUpdate(docB));
		Y.applyUpdate(finalDoc1, Y.encodeStateAsUpdate(docC));


    //      - finalDoc2: apply C's update, then A's, then B's
	const finalDoc2 = new Y.Doc();
		Y.applyUpdate(finalDoc2, Y.encodeStateAsUpdate(docC));
		Y.applyUpdate(finalDoc2, Y.encodeStateAsUpdate(docA));
		Y.applyUpdate(finalDoc2, Y.encodeStateAsUpdate(docB));

    // 4. Assert finalDoc1 and finalDoc2 end up with identical text,

		const final1 = finalDoc1.getText('content').toString();
		const final2 = finalDoc2.getText('content').toString();

    //    even though updates were applied in different orders.
		 expect(final1).toBe(final2);

		// All three edits plus the shared base survive. We don't hardcode
		// the string — block order comes from the random clientIDs.
		expect(final1).toContain('bat');
		expect(final1).toContain('book');
		expect(final1).toContain('dog');
		expect(final1).toContain('cat');
		expect(final1).toHaveLength(13);
  });
});
