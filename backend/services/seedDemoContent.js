const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const Registration = require('../models/Registration');
const Notification = require('../models/Notification');
const EventFeedback = require('../models/EventFeedback');
const VolunteerAssignment = require('../models/VolunteerAssignment');

const DEFAULT_PASSWORD = 'admin123';

const addDays = (days, base = new Date()) => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};

const isoDate = (date) => new Date(date).toISOString().slice(0, 10);

const DEMO_USERS = [
  {
    name: 'Admin One',
    email: 'admin@campusconnect.local',
    role: 'admin',
    department: 'Administration',
    year: '',
    phone: '9000000001',
    interests: ['operations', 'events', 'analytics'],
    skills: ['planning', 'coordination', 'reporting'],
    badges: ['Admin', 'Power User'],
    bio: 'Primary demo admin account with full access across the portal.',
  },
  {
    name: 'Ayush Gadewar',
    email: 'ayush.admin@campusconnect.local',
    role: 'admin',
    department: 'Administration',
    year: '',
    phone: '9000000005',
    interests: ['operations', 'events', 'analytics'],
    skills: ['planning', 'coordination', 'reporting'],
    badges: ['Admin', 'Power User'],
    bio: 'Secondary demo admin account used for login testing.',
  },
  {
    name: 'Ayush Gadewar',
    email: 'superadmin@campusconnect.local',
    role: 'super_admin',
    department: 'Administration',
    year: '',
    phone: '9000000006',
    interests: ['operations', 'events', 'analytics'],
    skills: ['planning', 'coordination', 'reporting'],
    badges: ['Super Admin', 'Power User'],
    bio: 'Super admin demo account used for elevated access testing.',
  },
  {
    name: 'Meera Joshi',
    email: 'student.demo@campusconnect.local',
    role: 'student',
    department: 'Computer Science',
    year: '3rd Year',
    phone: '9000000002',
    interests: ['hackathons', 'design', 'placements'],
    skills: ['react', 'ui design', 'public speaking'],
    badges: ['Top Contributor', 'Event Explorer'],
    bio: 'Demo student profile used for registrations, bookmarks, and notifications.',
  },
  {
    name: 'Rohan Kulkarni',
    email: 'coordinator.demo@campusconnect.local',
    role: 'coordinator',
    department: 'Training & Placement',
    year: '',
    phone: '9000000003',
    interests: ['placement', 'events'],
    skills: ['organization', 'communication'],
    badges: ['Coordinator'],
    bio: 'Demo coordinator for event approvals and placements.',
  },
  {
    name: 'Ananya Patil',
    email: 'volunteer.demo@campusconnect.local',
    role: 'volunteer',
    department: 'Engineering',
    year: '2nd Year',
    phone: '9000000004',
    interests: ['community', 'logistics'],
    skills: ['support', 'check-in', 'crowd management'],
    badges: ['Volunteer', 'Team Helper'],
    bio: 'Demo volunteer profile used to populate tasks and assignments.',
  },
];


const STUDENT_FIRST_NAMES = ['Aarav', 'Ananya', 'Kabir', 'Ishita', 'Riya', 'Vihaan', 'Saanvi', 'Arjun', 'Meera', 'Reyansh'];
const STUDENT_LAST_NAMES = ['Shah', 'Mehta', 'Patel', 'Joshi', 'Kulkarni', 'Verma', 'Reddy', 'Nair', 'Bose', 'Kapoor'];
const STUDENT_DEPARTMENTS = ['Computer Science', 'IT', 'Electronics', 'Mechanical', 'Civil', 'Management', 'Design', 'Mathematics', 'Physics', 'Chemistry'];
const STUDENT_INTERESTS = ['hackathons', 'design', 'sports', 'music', 'placements', 'research', 'community', 'robotics', 'media', 'entrepreneurship'];
const STUDENT_SKILLS = ['react', 'communication', 'analysis', 'leadership', 'python', 'ui design', 'editing', 'public speaking', 'problem solving', 'teamwork'];
const STUDENT_BADGES = ['Explorer', 'Builder', 'Organizer', 'Presenter', 'Mentor', 'Creator', 'Strategist', 'Helper', 'Problem Solver', 'Connector'];

const buildDemoStudents = (count = 100) => Array.from({ length: count }, (_, index) => {
  const first = STUDENT_FIRST_NAMES[index % STUDENT_FIRST_NAMES.length];
  const last = STUDENT_LAST_NAMES[Math.floor(index / STUDENT_FIRST_NAMES.length) % STUDENT_LAST_NAMES.length];
  const cohort = index + 1;
  const dept = STUDENT_DEPARTMENTS[index % STUDENT_DEPARTMENTS.length];
  const year = `${(index % 4) + 1}${['st', 'nd', 'rd', 'th'][Math.min(index % 4, 3)]} Year`;
  const interestA = STUDENT_INTERESTS[index % STUDENT_INTERESTS.length];
  const interestB = STUDENT_INTERESTS[(index + 3) % STUDENT_INTERESTS.length];
  const interestC = STUDENT_INTERESTS[(index + 6) % STUDENT_INTERESTS.length];
  const skillA = STUDENT_SKILLS[index % STUDENT_SKILLS.length];
  const skillB = STUDENT_SKILLS[(index + 2) % STUDENT_SKILLS.length];
  const skillC = STUDENT_SKILLS[(index + 4) % STUDENT_SKILLS.length];
  return {
    name: `${first} ${last} ${String(cohort).padStart(2, '0')}`,
    email: `student${String(cohort).padStart(3, '0')}@campusconnect.local`,
    role: 'student',
    department: dept,
    year,
    phone: `98${String(10000000 + cohort).slice(-8)}`,
    interests: [interestA, interestB, interestC],
    skills: [skillA, skillB, skillC],
    badges: [
      STUDENT_BADGES[index % STUDENT_BADGES.length],
      STUDENT_BADGES[(index + 3) % STUDENT_BADGES.length],
    ],
    bio: `Demo student ${cohort} from ${dept} with a focus on ${interestA}, ${interestB}, and ${interestC}.`,
  };
});

const DEMO_EVENTS = [
  {
    title: 'Freshers Welcome Orientation',
    description: 'Welcome session for new students with clubs, support services, and campus essentials.',
    date: isoDate(addDays(1)),
    endDate: isoDate(addDays(1)),
    venue: 'Open Amphitheatre',
    category: 'General',
    mode: 'offline',
    status: 'upcoming',
    featured: true,
    approvalRequired: false,
    capacity: 1000,
    waitlistCapacity: 100,
    organizerName: 'Student Council',
    tags: ['orientation', 'students', 'campus life'],
  },
  {
    title: 'React UI Workshop',
    description: 'Hands-on workshop covering reusable components, responsive layouts, and modern frontend patterns.',
    date: isoDate(addDays(2)),
    endDate: isoDate(addDays(2)),
    venue: 'Computer Lab 3',
    category: 'Workshop',
    mode: 'offline',
    status: 'published',
    featured: false,
    approvalRequired: false,
    capacity: 60,
    waitlistCapacity: 20,
    organizerName: 'Web Dev Club',
    tags: ['react', 'frontend', 'workshop'],
  },
  {
    title: 'Resume & Interview Bootcamp',
    description: 'Placement prep with resume reviews, mock interviews, and recruiter tips.',
    date: isoDate(addDays(4)),
    endDate: isoDate(addDays(4)),
    venue: 'Seminar Hall B',
    category: 'Placement',
    mode: 'online',
    status: 'live',
    featured: true,
    approvalRequired: false,
    capacity: 150,
    waitlistCapacity: 0,
    organizerName: 'Training & Placement Cell',
    tags: ['career', 'resume', 'interview'],
  },
  {
    title: 'Campus Hackathon 2026',
    description: 'A 24-hour build sprint for developers, designers, and problem solvers with mentor support.',
    date: isoDate(addDays(7)),
    endDate: isoDate(addDays(8)),
    venue: 'Innovation Lab',
    category: 'Hackathon',
    mode: 'hybrid',
    status: 'upcoming',
    featured: true,
    approvalRequired: true,
    capacity: 220,
    waitlistCapacity: 60,
    organizerName: 'Coding Club',
    tags: ['ai', 'startup', 'teamwork'],
  },
  {
    title: 'Industry Connect Panel',
    description: 'A dialogue with recruiters and alumni on hiring trends, portfolios, and careers.',
    date: isoDate(addDays(10)),
    endDate: isoDate(addDays(10)),
    venue: 'Virtual Townhall',
    category: 'Placement',
    mode: 'online',
    status: 'published',
    featured: false,
    approvalRequired: true,
    capacity: 300,
    waitlistCapacity: 0,
    organizerName: 'Placement Cell',
    tags: ['industry', 'jobs', 'alumni'],
  },
  {
    title: 'Rhythm & Roots Fest',
    description: 'A cultural evening with music, dance, and stage performances from across campus.',
    date: isoDate(addDays(12)),
    endDate: isoDate(addDays(12)),
    venue: 'Main Auditorium',
    category: 'Cultural',
    mode: 'offline',
    status: 'upcoming',
    featured: true,
    approvalRequired: false,
    capacity: 600,
    waitlistCapacity: 0,
    organizerName: 'Cultural Committee',
    tags: ['dance', 'music', 'festival'],
  },
  {
    title: 'Data Science Masterclass',
    description: 'A seminar on practical analytics, dashboards, and modern machine learning workflows.',
    date: isoDate(addDays(15)),
    endDate: isoDate(addDays(15)),
    venue: 'Lecture Hall 2',
    category: 'Seminar',
    mode: 'hybrid',
    status: 'completed',
    featured: false,
    approvalRequired: true,
    capacity: 120,
    waitlistCapacity: 30,
    organizerName: 'IT Department',
    speakerName: 'Guest Faculty',
    speakerRole: 'Researcher',
    tags: ['data', 'analytics', 'ml'],
  },
  {
    title: 'Sports Championship Day',
    description: 'Inter-college finals for cricket, football, badminton, and track events.',
    date: isoDate(addDays(18)),
    endDate: isoDate(addDays(18)),
    venue: 'Sports Ground',
    category: 'Sports',
    mode: 'offline',
    status: 'upcoming',
    featured: false,
    approvalRequired: false,
    capacity: 800,
    waitlistCapacity: 0,
    organizerName: 'Sports Council',
    tags: ['fitness', 'championship', 'team'],
  },
  {
    title: 'Open Mic & Poetry Night',
    description: 'A relaxed evening for spoken word, music, and creative campus performances.',
    date: isoDate(addDays(20)),
    endDate: isoDate(addDays(20)),
    venue: 'Cafeteria Lawn',
    category: 'Cultural',
    mode: 'offline',
    status: 'published',
    featured: false,
    approvalRequired: false,
    capacity: 180,
    waitlistCapacity: 20,
    organizerName: 'Arts Circle',
    tags: ['poetry', 'music', 'open mic'],
  },
  {
    title: 'AI Club Demo Showcase',
    description: 'Student teams present smart campus projects, prototypes, and automation ideas.',
    date: isoDate(addDays(22)),
    endDate: isoDate(addDays(22)),
    venue: 'Innovation Atrium',
    category: 'Technical',
    mode: 'hybrid',
    status: 'published',
    featured: true,
    approvalRequired: false,
    capacity: 250,
    waitlistCapacity: 0,
    organizerName: 'AI Club',
    tags: ['ai', 'prototype', 'demo'],
  },
  {
    title: 'Blood Donation Drive',
    description: 'A community drive with medical staff, volunteer support, and safety briefings.',
    date: isoDate(addDays(24)),
    endDate: isoDate(addDays(24)),
    venue: 'Health Center',
    category: 'General',
    mode: 'offline',
    status: 'published',
    featured: false,
    approvalRequired: false,
    capacity: 140,
    waitlistCapacity: 0,
    organizerName: 'NSS',
    tags: ['social impact', 'health', 'community'],
  },
  {
    title: 'Women in Tech Talk',
    description: 'An inspiring panel discussing mentorship, leadership, and careers in technology.',
    date: isoDate(addDays(26)),
    endDate: isoDate(addDays(26)),
    venue: 'Seminar Hall A',
    category: 'Seminar',
    mode: 'hybrid',
    status: 'upcoming',
    featured: true,
    approvalRequired: false,
    capacity: 180,
    waitlistCapacity: 0,
    organizerName: 'Tech Society',
    tags: ['women', 'leadership', 'tech'],
  },
  {
    title: 'Code Sprint Challenge',
    description: 'A fast-paced technical challenge with coding rounds, puzzles, and team scoring.',
    date: isoDate(addDays(28)),
    endDate: isoDate(addDays(28)),
    venue: 'CC Lab 1',
    category: 'Technical',
    mode: 'online',
    status: 'published',
    featured: false,
    approvalRequired: false,
    capacity: 90,
    waitlistCapacity: 10,
    organizerName: 'Programming Club',
    tags: ['coding', 'puzzles', 'challenge'],
  },
  {
    title: 'Alumni Networking Evening',
    description: 'A networking event connecting current students with alumni mentors and industry guests.',
    date: isoDate(addDays(30)),
    endDate: isoDate(addDays(30)),
    venue: 'Conference Room',
    category: 'Placement',
    mode: 'offline',
    status: 'published',
    featured: false,
    approvalRequired: true,
    capacity: 160,
    waitlistCapacity: 0,
    organizerName: 'Alumni Cell',
    tags: ['networking', 'alumni', 'careers'],
  },
  {
    title: 'Startup Idea Pitch Day',
    description: 'Teams present startup ideas to a panel of mentors, investors, and faculty reviewers.',
    date: isoDate(addDays(33)),
    endDate: isoDate(addDays(33)),
    venue: 'Innovation Lab',
    category: 'Hackathon',
    mode: 'hybrid',
    status: 'upcoming',
    featured: true,
    approvalRequired: true,
    capacity: 130,
    waitlistCapacity: 20,
    organizerName: 'E-Cell',
    tags: ['startup', 'pitch', 'ideas'],
  },
  {
    title: 'Coding for Good Marathon',
    description: 'A social-impact hackathon focused on campus and community challenges.',
    date: isoDate(addDays(36)),
    endDate: isoDate(addDays(37)),
    venue: 'Innovation Lab',
    category: 'Hackathon',
    mode: 'hybrid',
    status: 'draft',
    featured: false,
    approvalRequired: true,
    capacity: 200,
    waitlistCapacity: 40,
    organizerName: 'Community Tech Club',
    tags: ['impact', 'coding', 'community'],
  },
  {
    title: 'Cyber Awareness Drive',
    description: 'A safety-oriented session on phishing, account hygiene, and student data protection.',
    date: isoDate(addDays(38)),
    endDate: isoDate(addDays(38)),
    venue: 'Online Webinar',
    category: 'General',
    mode: 'online',
    status: 'completed',
    featured: false,
    approvalRequired: false,
    capacity: 500,
    waitlistCapacity: 0,
    organizerName: 'IT Security Team',
    tags: ['security', 'awareness', 'webinar'],
  },
  {
    title: 'Robotics Expo',
    description: 'Student-built robots, automation displays, and hardware demos across departments.',
    date: isoDate(addDays(40)),
    endDate: isoDate(addDays(40)),
    venue: 'Exhibition Hall',
    category: 'Technical',
    mode: 'offline',
    status: 'completed',
    featured: false,
    approvalRequired: false,
    capacity: 260,
    waitlistCapacity: 0,
    organizerName: 'Robotics Club',
    tags: ['robotics', 'hardware', 'expo'],
  },
];

const ANNOUNCEMENTS = [
  {
    title: 'Welcome week schedule published',
    message: 'Orientation, club demos, and support desks are now live for freshers across all departments.',
    audience: 'all',
    isPinned: true,
  },
  {
    title: 'Hackathon registrations are open',
    message: 'Register early for Campus Hackathon 2026 and reserve your team slot before the limit fills.',
    audience: 'students',
    isPinned: true,
    eventTitle: 'Campus Hackathon 2026',
  },
  {
    title: 'Placement bootcamp live today',
    message: 'Resume reviews and mock interviews are happening today in the placement training room.',
    audience: 'students',
    isPinned: false,
    eventTitle: 'Resume & Interview Bootcamp',
  },
  {
    title: 'Volunteer briefing at 5 PM',
    message: 'All volunteers should attend the logistics briefing for the orientation and sports events.',
    audience: 'volunteers',
    isPinned: false,
  },
  {
    title: 'Cultural fest pass distribution',
    message: 'Passes for Rhythm & Roots Fest will be issued at the student activity desk from tomorrow.',
    audience: 'all',
    isPinned: true,
    eventTitle: 'Rhythm & Roots Fest',
  },
  {
    title: 'Network maintenance notice',
    message: 'A short maintenance window is scheduled overnight; event services will remain available.',
    audience: 'all',
    isPinned: false,
  },
  {
    title: 'Seminar hall booking reminder',
    message: 'Departments should confirm room requirements for the upcoming Data Science Masterclass.',
    audience: 'coordinators',
    isPinned: false,
    eventTitle: 'Data Science Masterclass',
  },
  {
    title: 'Alumni night guest list finalized',
    message: 'Students with networking interests are encouraged to register for the alumni evening.',
    audience: 'students',
    isPinned: false,
    eventTitle: 'Alumni Networking Evening',
  },
  {
    title: 'Sports championship fixtures posted',
    message: 'Match timings and team assignments are now visible for the Sports Championship Day.',
    audience: 'all',
    isPinned: false,
    eventTitle: 'Sports Championship Day',
  },
  {
    title: 'Security reminder for all logins',
    message: 'Please use strong passwords and keep your session secure on shared devices.',
    audience: 'all',
    isPinned: false,
  },
];

const REGISTRATION_EVENT_TITLES = [
  'Freshers Welcome Orientation',
  'React UI Workshop',
  'Resume & Interview Bootcamp',
  'Campus Hackathon 2026',
  'Rhythm & Roots Fest',
  'AI Club Demo Showcase',
  'Women in Tech Talk',
];

const NOTIFICATIONS = [
  {
    type: 'event',
    title: 'Orientation starts tomorrow',
    message: 'Your campus welcome orientation is scheduled for tomorrow morning.',
    link: '/events',
  },
  {
    type: 'announcement',
    title: 'New announcement from campus team',
    message: 'The latest campus notice has been published and is ready in your inbox.',
    link: '/announcements',
  },
  {
    type: 'registration',
    title: 'Registration confirmed',
    message: 'You have been registered for React UI Workshop.',
    link: '/my-registrations',
  },
  {
    type: 'reminder',
    title: 'Hackathon prep reminder',
    message: 'Team submissions and ideation documents close soon.',
    link: '/events',
  },
  {
    type: 'security',
    title: 'Security tip',
    message: 'Keep your login credentials private and sign out on shared devices.',
    link: '/profile',
  },
  {
    type: 'certificate',
    title: 'Certificate generated',
    message: 'Your event participation certificate is ready for download.',
    link: '/certificates',
  },
  {
    type: 'system',
    title: 'Profile updated successfully',
    message: 'Your recent account changes were saved to the system.',
    link: '/profile',
  },
  {
    type: 'promotion',
    title: 'Featured event spotlight',
    message: 'AI Club Demo Showcase is trending among technical events.',
    link: '/events',
  },
];

const VOLUNTEER_TASKS = [
  {
    eventTitle: 'Freshers Welcome Orientation',
    taskTitle: 'Entry desk coordination',
    details: 'Welcome attendees, confirm passes, and guide them to the seating area.',
    status: 'assigned',
  },
  {
    eventTitle: 'Rhythm & Roots Fest',
    taskTitle: 'Stage logistics support',
    details: 'Help backstage movement and keep the running order on time.',
    status: 'in_progress',
  },
  {
    eventTitle: 'Sports Championship Day',
    taskTitle: 'Scoreboard assistance',
    details: 'Coordinate with referees and update match scores during fixtures.',
    status: 'assigned',
  },
  {
    eventTitle: 'Blood Donation Drive',
    taskTitle: 'Registration table support',
    details: 'Assist donors with forms, water, and queue management.',
    status: 'assigned',
  },
];

const FEEDBACK = [
  { eventTitle: 'React UI Workshop', rating: 5, comment: 'Clear explanations and a very practical session.' },
  { eventTitle: 'Resume & Interview Bootcamp', rating: 4, comment: 'Useful mock questions and recruiter insights.' },
  { eventTitle: 'Campus Hackathon 2026', rating: 5, comment: 'Great excitement and a strong innovation vibe.' },
  { eventTitle: 'Rhythm & Roots Fest', rating: 5, comment: 'Amazing performances and a really lively crowd.' },
  { eventTitle: 'AI Club Demo Showcase', rating: 4, comment: 'Very impressive demos from student teams.' },
];

const ensureUser = async (userData) => {
  const email = String(userData.email).toLowerCase();
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.name = userData.name;
    existing.password = password;
    existing.role = userData.role;
    existing.department = userData.department || '';
    existing.year = userData.year || '';
    existing.phone = userData.phone || '';
    existing.interests = Array.isArray(userData.interests) ? userData.interests : [];
    existing.skills = Array.isArray(userData.skills) ? userData.skills : [];
    existing.badges = Array.isArray(userData.badges) ? userData.badges : [];
    existing.bio = userData.bio || '';
    existing.emailVerified = true;
    existing.emailVerificationToken = '';
    existing.emailVerificationExpires = null;
    existing.passwordResetToken = '';
    existing.passwordResetExpires = null;
    existing.refreshTokenHash = '';
    existing.refreshTokenIssuedAt = null;
    existing.refreshTokenVersion = 0;
    await existing.save();
    return existing;
  }
  return User.create({
    ...userData,
    email,
    password,
    emailVerified: true,
    emailVerificationToken: '',
    emailVerificationExpires: null,
    passwordResetToken: '',
    passwordResetExpires: null,
    refreshTokenHash: '',
    refreshTokenIssuedAt: null,
    refreshTokenVersion: 0,
  });
};

const ensureEvent = async (eventData, createdBy) => {
  const existing = await Event.findOne({ title: eventData.title });
  if (existing) return existing;
  return Event.create({
    ...eventData,
    createdBy: createdBy._id,
    tags: Array.isArray(eventData.tags) ? eventData.tags : [],
    posterUrl: eventData.posterUrl || '',
    imageUrl: eventData.imageUrl || '',
    locationUrl: eventData.locationUrl || '',
    certificateEnabled: true,
    certificateTemplateUrl: '',
    rules: eventData.rules || 'Follow the instructions shared by the organizer.',
  });
};

const ensureAnnouncement = async (announcementData, createdBy, eventMap) => {
  const existing = await Announcement.findOne({ title: announcementData.title });
  if (existing) return existing;
  return Announcement.create({
    title: announcementData.title,
    message: announcementData.message,
    audience: announcementData.audience,
    event: announcementData.eventTitle ? (eventMap.get(announcementData.eventTitle)?._id || null) : null,
    isPinned: Boolean(announcementData.isPinned),
    expiresAt: null,
    sendEmail: false,
    createdBy: createdBy._id,
  });
};

const ensureRegistration = async (user, event, overrides = {}) => {
  const existing = await Registration.findOne({ user: user._id, event: event._id });
  if (existing) return existing;
  const suffix = `${String(user._id).slice(-4)}-${String(event._id).slice(-4)}`.toUpperCase();
  return Registration.create({
    user: user._id,
    event: event._id,
    status: overrides.status || 'confirmed',
    checkedIn: Boolean(overrides.checkedIn),
    checkedInAt: overrides.checkedIn ? new Date() : null,
    ticketCode: overrides.ticketCode || `TK-${suffix}`,
    certificateCode: overrides.certificateCode || `CERT-${suffix}`,
    waitlistPosition: overrides.waitlistPosition || 0,
    cancelledAt: overrides.status === 'cancelled' ? new Date() : null,
  });
};

const ensureNotification = async (user, payload) => {
  const existing = await Notification.findOne({ user: user._id, title: payload.title });
  if (existing) return existing;
  return Notification.create({
    user: user._id,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    link: payload.link || '',
    sourceType: payload.sourceType || 'System',
    sourceId: payload.sourceId || '',
    metadata: payload.metadata || {},
    isRead: payload.isRead ?? false,
    readAt: payload.isRead ? new Date() : null,
    expiresAt: payload.expiresAt || null,
  });
};

const ensureVolunteerTask = async (volunteer, assignedBy, eventMap, taskData) => {
  const event = eventMap.get(taskData.eventTitle);
  if (!event) return null;
  const existing = await VolunteerAssignment.findOne({ volunteer: volunteer._id, event: event._id, taskTitle: taskData.taskTitle });
  if (existing) return existing;
  return VolunteerAssignment.create({
    event: event._id,
    volunteer: volunteer._id,
    taskTitle: taskData.taskTitle,
    details: taskData.details,
    status: taskData.status,
    assignedBy: assignedBy._id,
    dueAt: addDays(2),
    completedAt: taskData.status === 'completed' ? new Date() : null,
  });
};

const ensureFeedback = async (user, event, feedback) => {
  const existing = await EventFeedback.findOne({ user: user._id, event: event._id });
  if (existing) return existing;
  return EventFeedback.create({
    user: user._id,
    event: event._id,
    rating: feedback.rating,
    comment: feedback.comment,
  });
};

async function seedDemoContent() {
  if (process.env.SKIP_DEMO_SEED === 'true') return { seeded: false, reason: 'disabled' };

  const demoUsers = [...DEMO_USERS, ...buildDemoStudents(100)];
  const createdUsers = await Promise.all(demoUsers.map((user) => ensureUser(user)));
  const [adminUser, studentUser, coordinatorUser, volunteerUser, ...studentUsers] = createdUsers;
  const createdBy = adminUser;

  const eventMap = new Map();
  for (const eventData of DEMO_EVENTS) {
    const event = await ensureEvent(eventData, createdBy);
    eventMap.set(event.title, event);
  }

  for (const announcementData of ANNOUNCEMENTS) {
    await ensureAnnouncement(announcementData, createdBy, eventMap);
  }

  const registrationEvents = REGISTRATION_EVENT_TITLES.map((title) => eventMap.get(title)).filter(Boolean);
  for (const event of registrationEvents) {
    await ensureRegistration(studentUser, event, {
      status: 'confirmed',
      checkedIn: event.status === 'completed',
    });
  }

  const activeEvents = [...eventMap.values()].filter((event) => !['draft', 'cancelled'].includes(event.status));
  let generatedRegistrations = 0;
  const studentCohort = [studentUser, ...studentUsers].filter(Boolean);

  for (const [studentIndex, student] of studentCohort.entries()) {
    const registrationCount = 3 + (studentIndex % 4);
    const start = studentIndex % activeEvents.length;

    for (let slot = 0; slot < registrationCount; slot += 1) {
      const event = activeEvents[(start + slot * 3) % activeEvents.length];
      if (!event) continue;

      const shouldWaitlist = event.waitlistCapacity > 0 && (studentIndex + slot) % 9 === 0;
      const isCompletedEvent = event.status === 'completed';
      const shouldCancel = !shouldWaitlist && !isCompletedEvent && (studentIndex + slot) % 17 === 0;

      await ensureRegistration(student, event, {
        status: shouldWaitlist ? 'waitlisted' : shouldCancel ? 'cancelled' : 'confirmed',
        checkedIn: !shouldWaitlist && (isCompletedEvent || (slot === 0 && studentIndex % 2 === 0) || (studentIndex + slot) % 5 === 0),
        waitlistPosition: shouldWaitlist ? ((studentIndex % 12) + 1) : 0,
      });
      generatedRegistrations += 1;
    }
  }

  const studentNotifications = [
    ...NOTIFICATIONS,
    {
      type: 'registration',
      title: 'Booked for orientation',
      message: 'You are registered for Freshers Welcome Orientation.',
      link: '/my-registrations',
      sourceType: 'Registration',
      sourceId: String(eventMap.get('Freshers Welcome Orientation')?._id || ''),
    },
  ];

  for (const payload of studentNotifications) {
    await ensureNotification(studentUser, payload);
  }

  await ensureNotification(adminUser, {
    type: 'system',
    title: 'Demo dashboard ready',
    message: 'The portal is preloaded with sample events, announcements, registrations, and inbox items.',
    link: '/admin',
    sourceType: 'System',
  });

  await ensureNotification(coordinatorUser, {
    type: 'event',
    title: 'Approval queue updated',
    message: 'Several demo events are waiting for approval and publishing.',
    link: '/admin',
    sourceType: 'System',
  });

  for (const taskData of VOLUNTEER_TASKS) {
    await ensureVolunteerTask(volunteerUser, adminUser, eventMap, taskData);
  }

  for (const feedbackData of FEEDBACK) {
    const event = eventMap.get(feedbackData.eventTitle);
    if (event) await ensureFeedback(studentUser, event, feedbackData);
  }

  return {
    seeded: true,
    users: demoUsers.length,
    events: DEMO_EVENTS.length,
    announcements: ANNOUNCEMENTS.length,
    registrations: registrationEvents.length + generatedRegistrations,
    notifications: studentNotifications.length + 2,
    volunteerTasks: VOLUNTEER_TASKS.length,
    feedback: FEEDBACK.length,
  };
}

module.exports = { seedDemoContent, DEFAULT_PASSWORD };
