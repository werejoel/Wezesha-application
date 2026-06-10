// Mock data for Wezesha Impact System

export interface Partner {
  id: string;
  name: string;
  type: 'TVET' | 'CBO';
  location: string;
  district: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  status: 'Active' | 'Inactive';
  startDate: string;
  cohortsCount: number;
  assignedYBF: string;
  assignedInstructors: string[];
  youthCount: number;
}

export interface Personnel {
  id: string;
  name: string;
  role: 'YBF' | 'Instructor' | 'Enumerator';
  contact: string;
  email: string;
  assignedTo: string;
  programYearStart?: string;
  subjectArea?: string;
  geographicArea?: string;
  status: 'Active' | 'Inactive';
}

export interface Youth {
  id: string;
  fullName: string;
  dob: string;
  gender: 'Male' | 'Female';
  nationality: string;
  region: string;
  district: string;
  partner: string;
  programType: 'In-School' | 'Out-of-School';
  cohort: string;
  enrollmentDate: string;
  employmentStatus: 'Employed Full-time' | 'Employed Part-time' | 'Self-employed' | 'Unemployed';
  baselineIncome: number;
  currentIncome: number;
  aboveIPL: boolean;
  educationLevel: string;
  hasBusiness: boolean;
  businessPlan: 'Not Started' | 'In Progress' | 'Completed';
  cv: 'Not Started' | 'In Progress' | 'Completed';
  applicationLetter: 'Not Started' | 'In Progress' | 'Completed';
  attendanceRate: number;
  mentorshipStatus?: 'Active' | 'Graduated' | 'Dropped Out';
  riskFlag: boolean;
}

export interface Session {
  id: string;
  cohort: string;
  partner: string;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  sessionNumber: number;
  topic: string;
  facilitator: string;
  date: string;
  time: string;
  venue: string;
  attendanceCount: number;
  totalYouth: number;
}

export interface CaseNote {
  id: string;
  youthId: string;
  youthName: string;
  author: string;
  date: string;
  category: 'General Update' | 'At-Risk Flag' | 'Business Support' | 'Employment Lead' | 'Other';
  note: string;
  followUpDate?: string;
  assignedTo?: string;
}

export const partners: Partner[] = [
  { id: 'P001', name: 'Nairobi Technical Institute', type: 'TVET', location: 'Nairobi CBD', district: 'Nairobi', contactName: 'James Mwangi', contactPhone: '+254712345678', contactEmail: 'james@nti.ac.ke', status: 'Active', startDate: '2024-01-15', cohortsCount: 3, assignedYBF: 'Sarah Ochieng', assignedInstructors: ['John Kamau'], youthCount: 87 },
  { id: 'P002', name: 'Kisumu Youth CBO', type: 'CBO', location: 'Kisumu Town', district: 'Kisumu', contactName: 'Mary Akinyi', contactPhone: '+254723456789', contactEmail: 'mary@kysumuyouth.org', status: 'Active', startDate: '2024-03-01', cohortsCount: 2, assignedYBF: 'Peter Omondi', assignedInstructors: [], youthCount: 54 },
  { id: 'P003', name: 'Mombasa Polytechnic', type: 'TVET', location: 'Mombasa Island', district: 'Mombasa', contactName: 'Hassan Ali', contactPhone: '+254734567890', contactEmail: 'hassan@mombpoly.ac.ke', status: 'Active', startDate: '2024-02-10', cohortsCount: 2, assignedYBF: 'Fatima Hassan', assignedInstructors: ['Lucy Adhiambo'], youthCount: 62 },
  { id: 'P004', name: 'Nakuru Skills Centre', type: 'TVET', location: 'Nakuru Town', district: 'Nakuru', contactName: 'Grace Wanjiku', contactPhone: '+254745678901', contactEmail: 'grace@nakuruskills.ac.ke', status: 'Active', startDate: '2024-04-01', cohortsCount: 1, assignedYBF: 'David Kimani', assignedInstructors: [], youthCount: 31 },
  { id: 'P005', name: 'Eldoret Community Initiative', type: 'CBO', location: 'Eldoret Town', district: 'Uasin Gishu', contactName: 'Joseph Kiprop', contactPhone: '+254756789012', contactEmail: 'joseph@eci.org', status: 'Inactive', startDate: '2023-06-15', cohortsCount: 1, assignedYBF: 'Sarah Ochieng', assignedInstructors: [], youthCount: 22 },
  { id: 'P006', name: 'Thika Technical Training', type: 'TVET', location: 'Thika Town', district: 'Kiambu', contactName: 'Ann Njeri', contactPhone: '+254767890123', contactEmail: 'ann@thikatech.ac.ke', status: 'Active', startDate: '2025-01-10', cohortsCount: 1, assignedYBF: 'Peter Omondi', assignedInstructors: [], youthCount: 28 },
];

export const personnel: Personnel[] = [
  { id: 'YBF001', name: 'Sarah Ochieng', role: 'YBF', contact: '+254712000001', email: 'sarah@wezesha.org', assignedTo: 'Nairobi Technical Institute, Eldoret Community Initiative', programYearStart: '2024', status: 'Active' },
  { id: 'YBF002', name: 'Peter Omondi', role: 'YBF', contact: '+254712000002', email: 'peter@wezesha.org', assignedTo: 'Kisumu Youth CBO, Thika Technical Training', programYearStart: '2024', status: 'Active' },
  { id: 'YBF003', name: 'Fatima Hassan', role: 'YBF', contact: '+254712000003', email: 'fatima@wezesha.org', assignedTo: 'Mombasa Polytechnic', programYearStart: '2024', status: 'Active' },
  { id: 'YBF004', name: 'David Kimani', role: 'YBF', contact: '+254712000004', email: 'david@wezesha.org', assignedTo: 'Nakuru Skills Centre', programYearStart: '2025', status: 'Active' },
  { id: 'INS001', name: 'John Kamau', role: 'Instructor', contact: '+254723000001', email: 'john@nti.ac.ke', assignedTo: 'Nairobi Technical Institute', subjectArea: 'Business Studies', status: 'Active' },
  { id: 'INS002', name: 'Lucy Adhiambo', role: 'Instructor', contact: '+254723000002', email: 'lucy@mombpoly.ac.ke', assignedTo: 'Mombasa Polytechnic', subjectArea: 'Entrepreneurship', status: 'Active' },
  { id: 'ENM001', name: 'Kevin Otieno', role: 'Enumerator', contact: '+254734000001', email: 'kevin@wezesha.org', assignedTo: 'Nairobi, Kisumu', geographicArea: 'Nairobi, Kisumu', status: 'Active' },
  { id: 'ENM002', name: 'Ruth Chebet', role: 'Enumerator', contact: '+254734000002', email: 'ruth@wezesha.org', assignedTo: 'Mombasa, Nakuru', geographicArea: 'Mombasa, Nakuru', status: 'Active' },
];

export const youth: Youth[] = Array.from({ length: 40 }, (_, i) => {
  const names = ['Alice Wanjiru', 'Brian Odhiambo', 'Catherine Njeri', 'Daniel Kipchoge', 'Esther Auma', 'Francis Mutua', 'Grace Nyambura', 'Henry Oloo', 'Irene Wambui', 'James Kiptoo', 'Karen Muthoni', 'Leonard Onyango', 'Mercy Cherop', 'Nelson Maina', 'Olive Awuor', 'Patrick Mugo', 'Queen Achieng', 'Robert Njoroge', 'Susan Chepkoech', 'Timothy Wekesa', 'Ursula Mwende', 'Victor Ouma', 'Winnie Naliaka', 'Xavier Kibet', 'Yvonne Moraa', 'Zack Githae', 'Angela Wairimu', 'Ben Otieno', 'Clara Jepchirchir', 'Dennis Mwangi', 'Emily Nekesa', 'Fred Kamau', 'Gladys Atieno', 'Hugo Ndirangu', 'Ivy Jeptoo', 'Jack Musyoka', 'Kate Aoko', 'Liam Kigen', 'Monica Wafula', 'Noel Karanja'];
  const partnerNames = ['Nairobi Technical Institute', 'Kisumu Youth CBO', 'Mombasa Polytechnic', 'Nakuru Skills Centre', 'Thika Technical Training'];
  const statuses: Youth['employmentStatus'][] = ['Employed Full-time', 'Employed Part-time', 'Self-employed', 'Unemployed'];
  const milestones: Youth['businessPlan'][] = ['Not Started', 'In Progress', 'Completed'];
  const partner = partnerNames[i % 5];
  const attendance = 55 + Math.floor(Math.random() * 45);
  const baselineIncome = Math.floor(Math.random() * 15000) + 2000;
  const currentIncome = baselineIncome + Math.floor(Math.random() * 10000);
  return {
    id: `Y${String(i + 1).padStart(3, '0')}`,
    fullName: names[i],
    dob: `${1998 + Math.floor(Math.random() * 6)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    gender: i % 3 === 0 ? 'Male' : 'Female' as const,
    nationality: 'Kenyan',
    region: ['Nairobi', 'Kisumu', 'Mombasa', 'Nakuru', 'Kiambu'][i % 5],
    district: ['Nairobi', 'Kisumu', 'Mombasa', 'Nakuru', 'Kiambu'][i % 5],
    partner,
    programType: i % 3 === 2 ? 'Out-of-School' : 'In-School' as const,
    cohort: `Cohort ${2024 + Math.floor(i / 20)}-${(i % 3) + 1}`,
    enrollmentDate: `2024-${String((i % 6) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    employmentStatus: statuses[i % 4],
    baselineIncome,
    currentIncome,
    aboveIPL: currentIncome > 7500,
    educationLevel: ['Secondary', 'Certificate', 'Diploma', 'Primary'][i % 4],
    hasBusiness: i % 3 === 0,
    businessPlan: milestones[Math.min(Math.floor(attendance / 35), 2)],
    cv: milestones[Math.min(Math.floor(attendance / 40), 2)],
    applicationLetter: milestones[Math.min(Math.floor((attendance - 10) / 40), 2)],
    attendanceRate: attendance,
    mentorshipStatus: i < 15 ? (['Active', 'Graduated', 'Dropped Out'] as const)[i % 3] : undefined,
    riskFlag: attendance < 80,
  };
});

export const sessions: Session[] = [
  { id: 'S001', cohort: 'Cohort 2024-1', partner: 'Nairobi Technical Institute', term: 'Term 1', sessionNumber: 1, topic: 'Introduction to Entrepreneurship', facilitator: 'Sarah Ochieng', date: '2024-02-05', time: '09:00', venue: 'Hall A', attendanceCount: 24, totalYouth: 28 },
  { id: 'S002', cohort: 'Cohort 2024-1', partner: 'Nairobi Technical Institute', term: 'Term 1', sessionNumber: 2, topic: 'Business Idea Generation', facilitator: 'Sarah Ochieng', date: '2024-02-12', time: '09:00', venue: 'Hall A', attendanceCount: 26, totalYouth: 28 },
  { id: 'S003', cohort: 'Cohort 2024-1', partner: 'Nairobi Technical Institute', term: 'Term 1', sessionNumber: 3, topic: 'Market Research Basics', facilitator: 'John Kamau', date: '2024-02-19', time: '10:00', venue: 'Hall B', attendanceCount: 22, totalYouth: 28 },
  { id: 'S004', cohort: 'Cohort 2024-1', partner: 'Kisumu Youth CBO', term: 'Term 1', sessionNumber: 1, topic: 'Introduction to Entrepreneurship', facilitator: 'Peter Omondi', date: '2024-03-04', time: '14:00', venue: 'Community Hall', attendanceCount: 18, totalYouth: 22 },
  { id: 'S005', cohort: 'Cohort 2024-1', partner: 'Mombasa Polytechnic', term: 'Term 1', sessionNumber: 1, topic: 'Introduction to Entrepreneurship', facilitator: 'Fatima Hassan', date: '2024-02-08', time: '09:00', venue: 'Lecture Room 3', attendanceCount: 28, totalYouth: 30 },
  { id: 'S006', cohort: 'Cohort 2024-1', partner: 'Nairobi Technical Institute', term: 'Term 1', sessionNumber: 4, topic: 'Financial Literacy', facilitator: 'Sarah Ochieng', date: '2024-02-26', time: '09:00', venue: 'Hall A', attendanceCount: 25, totalYouth: 28 },
  { id: 'S007', cohort: 'Cohort 2024-1', partner: 'Nairobi Technical Institute', term: 'Term 1', sessionNumber: 5, topic: 'Business Plan Writing', facilitator: 'Sarah Ochieng', date: '2024-03-04', time: '09:00', venue: 'Hall A', attendanceCount: 27, totalYouth: 28 },
  { id: 'S008', cohort: 'Cohort 2024-1', partner: 'Nairobi Technical Institute', term: 'Term 1', sessionNumber: 6, topic: 'CV & Cover Letter Workshop', facilitator: 'John Kamau', date: '2024-03-11', time: '10:00', venue: 'Computer Lab', attendanceCount: 23, totalYouth: 28 },
  { id: 'S009', cohort: 'Cohort 2024-2', partner: 'Nakuru Skills Centre', term: 'Term 1', sessionNumber: 1, topic: 'Introduction to Entrepreneurship', facilitator: 'David Kimani', date: '2024-04-08', time: '09:00', venue: 'Main Hall', attendanceCount: 29, totalYouth: 31 },
  { id: 'S010', cohort: 'Cohort 2024-1', partner: 'Nairobi Technical Institute', term: 'Term 2', sessionNumber: 1, topic: 'Digital Marketing Basics', facilitator: 'Sarah Ochieng', date: '2024-05-06', time: '09:00', venue: 'Hall A', attendanceCount: 24, totalYouth: 28 },
];

export const caseNotes: CaseNote[] = [
  { id: 'CN001', youthId: 'Y001', youthName: 'Alice Wanjiru', author: 'Sarah Ochieng', date: '2024-03-15', category: 'General Update', note: 'Alice is progressing well. She has completed her business plan draft and is seeking feedback from peers.' },
  { id: 'CN002', youthId: 'Y002', youthName: 'Brian Odhiambo', author: 'Peter Omondi', date: '2024-03-18', category: 'At-Risk Flag', note: 'Brian has missed 3 consecutive sessions. Phone call attempted — no response. Home visit scheduled.', followUpDate: '2024-03-25', assignedTo: 'Kevin Otieno' },
  { id: 'CN003', youthId: 'Y003', youthName: 'Catherine Njeri', author: 'Sarah Ochieng', date: '2024-04-02', category: 'Business Support', note: 'Catherine launched her tailoring business last week. Needs support with pricing strategy and customer acquisition.' },
  { id: 'CN004', youthId: 'Y005', youthName: 'Esther Auma', author: 'Fatima Hassan', date: '2024-04-10', category: 'Employment Lead', note: 'Local hotel chain hiring front desk staff. Referred Esther for interview on April 15.' },
  { id: 'CN005', youthId: 'Y008', youthName: 'Henry Oloo', author: 'Peter Omondi', date: '2024-04-12', category: 'At-Risk Flag', note: 'Henry reported financial difficulties affecting attendance. Connected to emergency support fund.', followUpDate: '2024-04-20', assignedTo: 'Peter Omondi' },
  { id: 'CN006', youthId: 'Y010', youthName: 'James Kiptoo', author: 'David Kimani', date: '2024-04-15', category: 'General Update', note: 'James completed his CV and submitted 3 job applications this week. Very motivated.' },
  { id: 'CN007', youthId: 'Y001', youthName: 'Alice Wanjiru', author: 'Kevin Otieno', date: '2024-05-01', category: 'Business Support', note: 'Field visit: Alice\'s bead-making business is operational. Monthly revenue approximately UGX 8,000. Needs help with record-keeping.' },
];

export const dashboardStats = {
  totalPartners: { tvet: 4, cbo: 2 },
  totalYBFs: 4,
  totalInstructors: 2,
  totalYouth: 284,
  youthByGender: { male: 118, female: 166 },
  overallAttendance: 82,
  outputProgress: { businessPlan: 68, cv: 72, applicationLetter: 58 },
  outcomeProgress: { inWork: 64, avgIncomeChange: 42, aboveIPL: 56, businessesStarted: 38 },
  enrollmentByMonth: [
    { month: 'Jan', count: 45 },
    { month: 'Feb', count: 62 },
    { month: 'Mar', count: 54 },
    { month: 'Apr', count: 38 },
    { month: 'May', count: 31 },
    { month: 'Jun', count: 28 },
  ],
  attendanceByTerm: [
    { term: 'T1-S1', rate: 88 },
    { term: 'T1-S2', rate: 85 },
    { term: 'T1-S3', rate: 82 },
    { term: 'T1-S4', rate: 80 },
    { term: 'T1-S5', rate: 84 },
    { term: 'T1-S6', rate: 79 },
    { term: 'T2-S1', rate: 86 },
    { term: 'T2-S2', rate: 83 },
  ],
};
