// Verification Script for Xiaomi MiMo AI Agent Tool Calling
import { mimoAgent } from './src/services/mimoAgent.ts';
import { dbService } from './src/services/db.ts';

console.log('==================================================');
console.log('         MIMO LLM TOOL CALLING VERIFICATION        ');
console.log('==================================================\n');

async function testMiMoAgent() {
  console.log('Seeding mock user tester & recipient alice...');
  
  // Try to find or create tester
  let tester = await dbService.getUserByUsername('tester');
  if (!tester) {
    tester = await dbService.createUser({
      username: 'tester',
      wallet_address: '0x1111111111111111111111111111111111111111',
      recovery_wallet: '0x2222222222222222222222222222222222222222'
    });
  }

  // Ensure wallet has balance for tester
  let wallet = await dbService.getWalletByUserId(tester.id);
  if (!wallet) {
    wallet = await dbService.createWallet(tester.id);
  }
  await dbService.updateWalletBalance(tester.id, 50.0);

  // Ensure recipient @alice exists
  let alice = await dbService.getUserByUsername('alice');
  if (!alice) {
    alice = await dbService.createUser({
      username: 'alice',
      wallet_address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
      recovery_wallet: '0xabc123...'
    });
  }

  console.log('Query: "Send 5 ARC to @alice"');
  console.log('Invoking Agent loop...');

  try {
    const result = await mimoAgent.runChatSession(
      'Send 5 ARC to @alice',
      tester.id,
      'tester'
    );

    console.log('\n==================================================');
    console.log('Agent Response Text:');
    console.log(result.text);
    console.log('==================================================');
    console.log('Tools Executed:');
    console.dir(result.toolCallsExecuted, { depth: null, colors: true });
    console.log('==================================================');

    const usernameResolved = result.toolCallsExecuted.some(t => t.tool === 'resolve_username');
    const sendArcCalled = result.toolCallsExecuted.some(t => t.tool === 'send_arc');

    if (usernameResolved && sendArcCalled) {
      console.log('  ✓ SUCCESS: AI correctly resolved @alice and called send_arc tool.');
      return true;
    } else {
      console.log('  ✗ FAILURE: Tool calling sequence incomplete.');
      console.log(`    Username Resolved: ${usernameResolved}, Send Arc Called: ${sendArcCalled}`);
      return false;
    }
  } catch (e) {
    console.error('Agent execution crashed:', e);
    return false;
  }
}

testMiMoAgent().then(success => {
  if (success) {
    console.log('\n  MIMO AGENT TESTS PASSED!');
  } else {
    console.log('\n  MIMO AGENT TESTS FAILED.');
  }
});
