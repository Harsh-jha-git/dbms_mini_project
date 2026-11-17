import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

function getStudentCookie(student_id = 1, username = 'student1', user_id = 110) {
  const user = {
    id: user_id,
    username: username,
    role: 'student',
    student_id: student_id,
    recruiter_id: null,
  };
  const secret = process.env.SESSION_SECRET;
  const p = Buffer.from(JSON.stringify(user)).toString('base64url');
  const s = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  return `sid=${p}.${s}`;
}

function getRecruiterCookie() {
  const user = {
    id: 1,
    username: 'recruiter1',
    role: 'recruiter',
    student_id: null,
    recruiter_id: 1,
  };
  const secret = process.env.SESSION_SECRET;
  const p = Buffer.from(JSON.stringify(user)).toString('base64url');
  const s = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  return `sid=${p}.${s}`;
}

async function runTests() {
  console.log('--- Starting API Tests for /api/graph ---');
  const cookie = getStudentCookie(1, 'student1', 110);
  const recruiterCookie = getRecruiterCookie();

  // Test 1: Unauthorized access without cookie
  console.log('\n[Test 1] GET without authentication (expect 401)...');
  const resNoAuth = await fetch(`${BASE_URL}/api/graph?view=recommend`);
  console.log('Status:', resNoAuth.status);
  const jsonNoAuth = await resNoAuth.json();
  console.log('Response:', jsonNoAuth);
  if (resNoAuth.status !== 401) throw new Error('Expected 401 Unauthorized');

  // Test 2: Unauthorized access with non-student role
  console.log('\n[Test 2] GET with recruiter role (expect 401)...');
  const resRecruiter = await fetch(`${BASE_URL}/api/graph?view=recommend`, {
    headers: { Cookie: recruiterCookie },
  });
  console.log('Status:', resRecruiter.status);
  const jsonRecruiter = await resRecruiter.json();
  console.log('Response:', jsonRecruiter);
  if (resRecruiter.status !== 401) throw new Error('Expected 401 Unauthorized');

  // Test 3: GET ?view=recommend for student1
  console.log('\n[Test 3] GET ?view=recommend for student1...');
  const resRec = await fetch(`${BASE_URL}/api/graph?view=recommend`, {
    headers: { Cookie: cookie },
  });
  console.log('Status:', resRec.status);
  const recs = await resRec.json();
  console.log('Recommendations count:', recs.length);
  console.log('Recommendations:', recs);
  if (resRec.status !== 200) throw new Error('Expected 200 OK');

  // Test 4: GET ?view=saved initially
  console.log('\n[Test 4] GET ?view=saved for student1...');
  const resSavedInitial = await fetch(`${BASE_URL}/api/graph?view=saved`, {
    headers: { Cookie: cookie },
  });
  console.log('Status:', resSavedInitial.status);
  const savedInitial = await resSavedInitial.json();
  console.log('Initial saved count:', savedInitial.length);
  if (resSavedInitial.status !== 200) throw new Error('Expected 200 OK');

  // Test 5: POST { opportunityId: 43 }
  console.log('\n[Test 5] POST { opportunityId: 43 } (Save opportunity)...');
  const resPost = await fetch(`${BASE_URL}/api/graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ opportunityId: 43 }),
  });
  console.log('Status:', resPost.status);
  const jsonPost = await resPost.json();
  console.log('Response:', jsonPost);
  if (resPost.status !== 200 || !jsonPost.ok) throw new Error('POST failed');

  // Test 6: GET ?view=saved after POST
  console.log('\n[Test 6] GET ?view=saved after saving opportunity 43...');
  const resSavedAfterPost = await fetch(`${BASE_URL}/api/graph?view=saved`, {
    headers: { Cookie: cookie },
  });
  const savedAfterPost = await resSavedAfterPost.json();
  console.log('Saved items:', savedAfterPost);
  const item43 = savedAfterPost.find((i) => i.id === 43);
  if (!item43) throw new Error('Opportunity 43 not found in saved items');
  console.log('Found saved item:', item43);

  // Test 7: PATCH { opportunityId: 43, note: 'Target summer internship' }
  console.log('\n[Test 7] PATCH note for opportunity 43...');
  const testNote = 'Target summer internship: prepare embedded C and RTOS interview';
  const resPatch = await fetch(`${BASE_URL}/api/graph`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ opportunityId: 43, note: testNote }),
  });
  console.log('Status:', resPatch.status);
  const jsonPatch = await resPatch.json();
  console.log('Response:', jsonPatch);
  if (resPatch.status !== 200 || jsonPatch.note !== testNote) throw new Error('PATCH failed');

  // Test 8: GET ?view=saved to verify updated note
  console.log('\n[Test 8] GET ?view=saved to verify updated note...');
  const resSavedAfterPatch = await fetch(`${BASE_URL}/api/graph?view=saved`, {
    headers: { Cookie: cookie },
  });
  const savedAfterPatch = await resSavedAfterPatch.json();
  const updatedItem43 = savedAfterPatch.find((i) => i.id === 43);
  console.log('Verified updated item:', updatedItem43);
  if (updatedItem43?.note !== testNote) throw new Error('Note was not updated');

  // Test 9: DELETE ?opportunityId=43
  console.log('\n[Test 9] DELETE ?opportunityId=43...');
  const resDelete = await fetch(`${BASE_URL}/api/graph?opportunityId=43`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  console.log('Status:', resDelete.status);
  const jsonDelete = await resDelete.json();
  console.log('Response:', jsonDelete);
  if (resDelete.status !== 200 || !jsonDelete.ok) throw new Error('DELETE failed');

  // Test 10: GET ?view=saved after DELETE
  console.log('\n[Test 10] GET ?view=saved to verify deletion...');
  const resSavedAfterDelete = await fetch(`${BASE_URL}/api/graph?view=saved`, {
    headers: { Cookie: cookie },
  });
  const savedAfterDelete = await resSavedAfterDelete.json();
  console.log('Saved items after deletion:', savedAfterDelete);
  const deletedItem = savedAfterDelete.find((i) => i.id === 43);
  if (deletedItem) throw new Error('Opportunity 43 was not deleted');

  // Test 11: Test collaborative filtering with student 65 (who has applications)
  console.log('\n[Test 11] GET ?view=recommend for student65 (collaborative filtering with peers)...');
  const cookie65 = getStudentCookie(65, 'student65', 174);
  const resRec65 = await fetch(`${BASE_URL}/api/graph?view=recommend`, {
    headers: { Cookie: cookie65 },
  });
  console.log('Status:', resRec65.status);
  const recs65 = await resRec65.json();
  console.log('Recommendations count for student 65:', recs65.length);
  console.log('Top recommendations:', recs65);
  if (recs65.length === 0) throw new Error('Expected recommendations for student 65');

  console.log('\n ALL TESTS PASSED SUCCESSFULLY! ');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
