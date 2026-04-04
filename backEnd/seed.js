const pool = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🌱 Starting seed...');

    // Ensure users table has role column
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'enumerator'
    `);
    console.log('✅ Users table updated with role column');

    // 1. Partners
    console.log('Adding partners...');
    const partnerMap = {};

    const partners = [
      { name: 'Nairobi Technical Institute', type: 'TVET', location: 'Nairobi CBD', district: 'Nairobi', contact_name: 'James Mwangi', contact_phone: '+254712345678', contact_email: 'james@nti.ac.ke', status: 'Active', partnership_date: '2024-01-15' },
      { name: 'Kisumu Youth CBO', type: 'CBO', location: 'Kisumu Town', district: 'Kisumu', contact_name: 'Mary Akinyi', contact_phone: '+254723456789', contact_email: 'mary@kysumuyouth.org', status: 'Active', partnership_date: '2024-03-01' },
      { name: 'Mombasa Polytechnic', type: 'TVET', location: 'Mombasa Island', district: 'Mombasa', contact_name: 'Hassan Ali', contact_phone: '+254734567890', contact_email: 'hassan@mombpoly.ac.ke', status: 'Active', partnership_date: '2024-02-10' },
      { name: 'Nakuru Skills Centre', type: 'TVET', location: 'Nakuru Town', district: 'Nakuru', contact_name: 'Grace Wanjiku', contact_phone: '+254745678901', contact_email: 'grace@nakuruskills.ac.ke', status: 'Active', partnership_date: '2024-04-01' },
      { name: 'Eldoret Community Initiative', type: 'CBO', location: 'Eldoret Town', district: 'Uasin Gishu', contact_name: 'Joseph Kiprop', contact_phone: '+254756789012', contact_email: 'joseph@eci.org', status: 'Inactive', partnership_date: '2023-06-15' },
      { name: 'Thika Technical Training', type: 'TVET', location: 'Thika Town', district: 'Kiambu', contact_name: 'Ann Njeri', contact_phone: '+254767890123', contact_email: 'ann@thikatech.ac.ke', status: 'Active', partnership_date: '2025-01-10' },
    ];

    for (const p of partners) {
      const res = await client.query(
        `INSERT INTO partner_institution (name, type, location, district, contact_name, contact_phone, contact_email, status, partnership_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING
         RETURNING id, name`,
        [p.name, p.type, p.location, p.district, p.contact_name, p.contact_phone, p.contact_email, p.status, p.partnership_date]
      );
      if (res.rows[0]) partnerMap[p.name] = res.rows[0].id;
    }
    console.log(`✅ ${Object.keys(partnerMap).length} partners added`);

    // 2. YBFs
    console.log('Adding YBFs...');
    const ybfs = [
      { name: 'Sarah Ochieng', contact_phone: '+254712000001', contact_email: 'sarah@wezesha.org' },
      { name: 'Peter Omondi', contact_phone: '+254712000002', contact_email: 'peter@wezesha.org' },
      { name: 'Fatima Hassan', contact_phone: '+254712000003', contact_email: 'fatima@wezesha.org' },
      { name: 'David Kimani', contact_phone: '+254712000004', contact_email: 'david@wezesha.org' },
    ];

    for (const y of ybfs) {
      await client.query(
        `INSERT INTO youth_business_fellow (name, contact_phone, contact_email)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [y.name, y.contact_phone, y.contact_email]
      );
    }
    console.log(`✅ ${ybfs.length} YBFs added`);

    // 3. Cohorts — cohort uses partner_institution_id + program_year (no name column)
    console.log('Adding cohorts...');
    const cohortMap = {}; // "partnerName-year" => uuid

    const cohortDefs = [
      { partnerName: 'Nairobi Technical Institute', program_year: 2024 },
      { partnerName: 'Kisumu Youth CBO', program_year: 2024 },
      { partnerName: 'Mombasa Polytechnic', program_year: 2024 },
      { partnerName: 'Nakuru Skills Centre', program_year: 2024 },
      { partnerName: 'Thika Technical Training', program_year: 2025 },
    ];

    for (const c of cohortDefs) {
      const partnerId = partnerMap[c.partnerName];
      if (!partnerId) continue;
      const res = await client.query(
        `INSERT INTO cohort (partner_institution_id, program_year)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [partnerId, c.program_year]
      );
      if (res.rows[0]) cohortMap[`${c.partnerName}-${c.program_year}`] = res.rows[0].id;
    }
    console.log(`✅ ${Object.keys(cohortMap).length} cohorts added`);

    // 4. Youth
console.log('Adding youth...');
const names = ['Alice Wanjiru','Brian Odhiambo','Catherine Njeri','Daniel Kipchoge','Esther Auma','Francis Mutua','Grace Nyambura','Henry Oloo','Irene Wambui','James Kiptoo','Karen Muthoni','Leonard Onyango','Mercy Cherop','Nelson Maina','Olive Awuor','Patrick Mugo','Queen Achieng','Robert Njoroge','Susan Chepkoech','Timothy Wekesa','Ursula Mwende','Victor Ouma','Winnie Naliaka','Xavier Kibet','Yvonne Moraa','Zack Githae','Angela Wairimu','Ben Otieno','Clara Jepchirchir','Dennis Mwangi','Emily Nekesa','Fred Kamau','Gladys Atieno','Hugo Ndirangu','Ivy Jeptoo','Jack Musyoka','Kate Aoko','Liam Kigen','Monica Wafula','Noel Karanja'];
const partnerNames = ['Nairobi Technical Institute','Kisumu Youth CBO','Mombasa Polytechnic','Nakuru Skills Centre','Thika Technical Training'];
const districts = ['Nairobi','Kisumu','Mombasa','Nakuru','Kiambu'];
const youthMap = {};

for (let i = 0; i < names.length; i++) {
  const partnerName = partnerNames[i % 5];
  const partnerId = partnerMap[partnerName];

  // Find ANY cohort that belongs to this partner
  const cohortRes = await client.query(
    `SELECT id FROM cohort WHERE partner_institution_id = $1 LIMIT 1`,
    [partnerId]
  );

  if (!cohortRes.rows[0]) {
    console.log(`⚠️ No cohort found for ${partnerName}, skipping ${names[i]}`);
    continue;
  }

  const cohortId = cohortRes.rows[0].id;
  const programYear = i < 20 ? 2024 : 2025;
  const gender = i % 3 === 0 ? 'Male' : 'Female';
  const district = districts[i % 5];
  const dob = `${1998 + (i % 6)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
  const programType = i % 3 === 2 ? 'Out-of-school' : 'In-school';

  const res = await client.query(
    `INSERT INTO youth (
       full_name, date_of_birth, gender, nationality,
       district_of_residence, region, partner_institution_id,
       cohort_id, program_type, program_year, enrolment_date
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT DO NOTHING
     RETURNING id, full_name`,
    [
      names[i], dob, gender, 'Kenyan',
      district, district, partnerId,
      cohortId, programType, programYear,
      `2024-${String((i % 6) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
    ]
  );
  if (res.rows[0]) youthMap[names[i]] = res.rows[0].id;
}
console.log(`✅ ${Object.keys(youthMap).length} youth added`);
  // 5. Sessions
console.log('Adding sessions...');
const sessionDefs = [
  { partnerName: 'Nairobi Technical Institute', programYear: 2024, topic: 'Introduction to Entrepreneurship', date: '2024-02-05', venue: 'Hall A', term_number: 1, session_number: 1 },
  { partnerName: 'Nairobi Technical Institute', programYear: 2024, topic: 'Business Idea Generation', date: '2024-02-12', venue: 'Hall A', term_number: 1, session_number: 2 },
  { partnerName: 'Nairobi Technical Institute', programYear: 2024, topic: 'Market Research Basics', date: '2024-02-19', venue: 'Hall B', term_number: 1, session_number: 3 },
  { partnerName: 'Kisumu Youth CBO', programYear: 2024, topic: 'Introduction to Entrepreneurship', date: '2024-03-04', venue: 'Community Hall', term_number: 1, session_number: 1 },
  { partnerName: 'Mombasa Polytechnic', programYear: 2024, topic: 'Introduction to Entrepreneurship', date: '2024-02-08', venue: 'Lecture Room 3', term_number: 1, session_number: 1 },
  { partnerName: 'Nairobi Technical Institute', programYear: 2024, topic: 'Financial Literacy', date: '2024-02-26', venue: 'Hall A', term_number: 1, session_number: 4 },
  { partnerName: 'Nairobi Technical Institute', programYear: 2024, topic: 'Business Plan Writing', date: '2024-03-04', venue: 'Hall A', term_number: 1, session_number: 5 },
  { partnerName: 'Nairobi Technical Institute', programYear: 2024, topic: 'CV & Cover Letter Workshop', date: '2024-03-11', venue: 'Computer Lab', term_number: 1, session_number: 6 },
  { partnerName: 'Nakuru Skills Centre', programYear: 2024, topic: 'Introduction to Entrepreneurship', date: '2024-04-08', venue: 'Main Hall', term_number: 1, session_number: 1 },
  { partnerName: 'Nairobi Technical Institute', programYear: 2024, topic: 'Digital Marketing Basics', date: '2024-05-06', venue: 'Hall A', term_number: 2, session_number: 1 },
];

for (const s of sessionDefs) {
  const cohortRes = await client.query(
    `SELECT id FROM cohort WHERE partner_institution_id = $1 LIMIT 1`,
    [partnerMap[s.partnerName]]
  );
  if (!cohortRes.rows[0]) continue;

  await client.query(
    `INSERT INTO session (cohort_id, topic, session_date, venue, term_number, session_number)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [cohortRes.rows[0].id, s.topic, s.date, s.venue, s.term_number, s.session_number]
  );
}
console.log(`✅ ${sessionDefs.length} sessions added`);
// 6. Create system users
console.log('Adding system users...');
const users = [
  { name: 'System Admin', email: 'admin@wezesha.org', password: 'admin123', role: 'admin' },
  { name: 'Youth Business Fellow', email: 'ybf@wezesha.org', password: 'ybf123', role: 'ybf' },
  { name: 'Enumerator', email: 'enumerator@wezesha.org', password: 'enum123', role: 'enumerator' },
];

for (const user of users) {
  const hashedPassword = await bcrypt.hash(user.password, 10);
  await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email`,
    [user.name, user.email, hashedPassword, user.role]
  );
}
console.log(`✅ ${users.length} users added`);

// Get admin user id for case notes
const adminUserRes = await client.query(
  `SELECT id FROM users WHERE email = $1`,
  ['admin@wezesha.org']
);
const adminUserId = adminUserRes.rows[0].id;




// 7. Case notes
console.log('Adding case notes...');
const caseNotes = [
  { youthName: 'Alice Wanjiru', category: 'General Update', note: 'Alice is progressing well. She has completed her business plan draft and is seeking feedback from peers.' },
  { youthName: 'Brian Odhiambo', category: 'At-Risk Flag', note: 'Brian has missed 3 consecutive sessions. Phone call attempted — no response. Home visit scheduled.', followUp: '2024-03-25' },
  { youthName: 'Catherine Njeri', category: 'Business Support', note: 'Catherine launched her tailoring business last week. Needs support with pricing strategy.' },
  { youthName: 'Esther Auma', category: 'Employment Lead', note: 'Local hotel chain hiring front desk staff. Referred Esther for interview on April 15.' },
  { youthName: 'Henry Oloo', category: 'At-Risk Flag', note: 'Henry reported financial difficulties affecting attendance. Connected to emergency support fund.', followUp: '2024-04-20' },
  { youthName: 'James Kiptoo', category: 'General Update', note: 'James completed his CV and submitted 3 job applications this week. Very motivated.' },
  { youthName: 'Alice Wanjiru', category: 'Business Support', note: "Field visit: Alice's bead-making business is operational. Monthly revenue approximately KES 8,000." },
];

for (const cn of caseNotes) {
  const youthId = youthMap[cn.youthName];
  if (!youthId) continue;
  await client.query(
    `INSERT INTO case_note (youth_id, author_id, category, note_text, follow_up_due, follow_up_required)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [youthId, adminUserId, cn.category, cn.note, cn.followUp || null, !!cn.followUp]
  );
}
console.log(`✅ ${caseNotes.length} case notes added`);



    await client.query('COMMIT');
    console.log('\n🎉 Seed completed successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    process.exit();
  }
}

seed();