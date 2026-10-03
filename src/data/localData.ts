/*
 * Standalone frontend data layer.
 *
 * Nothing in this module performs a network request. It provides realistic demo
 * content and persists user-created state in localStorage so the static build
 * remains interactive when opened from any frontend host.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

type LocalResponse<T = any> = Promise<{ data: T }>;

const today = new Date();
const isoDate = (offset = 0) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const DEMO_SUBJECTS = [
  { id: 1, subject_name: 'Physics', subject_code: 'PHY-12', credit: 4, type: 'class' },
  { id: 2, subject_name: 'Chemistry', subject_code: 'CHE-12', credit: 4, type: 'class' },
  { id: 3, subject_name: 'Mathematics', subject_code: 'MAT-12', credit: 5, type: 'class' },
  { id: 4, subject_name: 'English', subject_code: 'ENG-12', credit: 3, type: 'class' },
];

const DEMO_RESOURCES = [
  { id: 1, class: 'class12', faculty: 'Science', subjectName: 'Physics', subject: 'Physics', unit: 'Mechanics', chapterName: 'Kinematics', chapter_name: 'Kinematics', resource_type: 'note', upload_mode: 'manual', created_at: `${isoDate(-2)} 09:30:00` },
  { id: 2, class: 'class12', faculty: 'Science', subjectName: 'Physics', subject: 'Physics', unit: 'Mechanics', chapterName: 'Newton’s laws', chapter_name: 'Newton’s laws', resource_type: 'numerical', upload_mode: 'manual', created_at: `${isoDate(-4)} 15:10:00` },
  { id: 3, class: 'class12', faculty: 'Science', subjectName: 'Chemistry', subject: 'Chemistry', unit: 'Organic chemistry', chapterName: 'Hydrocarbons', chapter_name: 'Hydrocarbons', resource_type: 'note', upload_mode: 'manual', created_at: `${isoDate(-6)} 11:15:00` },
  { id: 4, class: 'class12', faculty: 'Science', subjectName: 'Mathematics', subject: 'Mathematics', unit: 'Calculus', chapterName: 'Limits and continuity', chapter_name: 'Limits and continuity', resource_type: 'miq', upload_mode: 'manual', created_at: `${isoDate(-8)} 08:45:00` },
];

const DEMO_COLLECTIONS = [
  { id: 1, title: 'TU B.Sc. CSIT entrance preparation', description: 'Topic-wise practice, timed mock tests, and past questions for focused entrance preparation.', price: 199, discount_price: 150, image_url: '' },
  { id: 2, title: 'Grade 12 science revision', description: 'A balanced revision track across physics, chemistry, mathematics, and English.', price: 0, discount_price: 0, image_url: '' },
  { id: 3, title: 'CMAT practice studio', description: 'Short practice sets for verbal ability, quantitative reasoning, and general awareness.', price: 249, discount_price: 199, image_url: '' },
];

const DEMO_QUIZZES = [
  { id: 101, collection_id: 1, title: 'Full mock test 01', mode: 'PRACTICE', time_limit: 35, negative_marking: 0.25, price: 0, user_attempt_count: 1, latest_attempt_id: 7001, start_time: null, end_time: null },
  { id: 102, collection_id: 1, title: 'Physics and mathematics sprint', mode: 'PRACTICE', time_limit: 20, negative_marking: 0, price: 0, user_attempt_count: 0, latest_attempt_id: null, start_time: null, end_time: null },
  { id: 103, collection_id: 1, title: 'Weekend live challenge', mode: 'LIVE', time_limit: 45, negative_marking: 0.25, price: 0, user_attempt_count: 0, latest_attempt_id: null, start_time: `${isoDate(2)} 10:00:00`, end_time: `${isoDate(2)} 11:00:00` },
];

const DEMO_QUESTIONS = [
  { questionId: 'q1', questionNo: 1, questionText: 'Which quantity remains constant in uniform circular motion?', options: ['Velocity', 'Speed', 'Displacement', 'Acceleration'], correctOption: 1, marks: 1, explanation: 'The direction of velocity changes, but its magnitude—speed—remains constant.', originalIndex: 0 },
  { questionId: 'q2', questionNo: 2, questionText: 'If f(x) = 2x + 3, what is f(4)?', options: ['8', '10', '11', '14'], correctOption: 2, marks: 1, explanation: 'Substitute x = 4: 2(4) + 3 = 11.', originalIndex: 1 },
  { questionId: 'q3', questionNo: 3, questionText: 'Which element has the atomic number 6?', options: ['Boron', 'Carbon', 'Nitrogen', 'Oxygen'], correctOption: 1, marks: 1, explanation: 'Carbon has six protons and therefore atomic number 6.', originalIndex: 2 },
  { questionId: 'q4', questionNo: 4, questionText: 'Choose the correctly spelled word.', options: ['Accomodate', 'Acommodate', 'Accommodate', 'Acomodate'], correctOption: 2, marks: 1, explanation: 'Accommodate contains two c’s and two m’s.', originalIndex: 3 },
];

const DEMO_BLOGS = [
  { id: 1, slug: 'weekly-study-reset', title: 'A practical weekly study reset', short_description: 'Use twenty minutes on Sunday to make the rest of the week easier.', content: '<h2>Review before you plan</h2><p>Look at what you completed, what slipped, and which subjects need another pass. Choose three outcomes for the coming week and give each one a place on your calendar.</p>', image: '', created_at: `${isoDate(-1)} 08:00:00` },
  { id: 2, slug: 'mock-test-review', title: 'How to review a mock test', short_description: 'The score matters less than the pattern behind each mistake.', content: '<h2>Sort every mistake</h2><p>Mark errors as concept, recall, calculation, or time-management problems. Your next study session should target the largest group.</p>', image: '', created_at: `${isoDate(-5)} 13:30:00` },
];

const DEFAULT_TARGETS = [
  { id: 1, title: 'Review mechanics notes', target_date: isoDate(), is_completed: 1, progress: 100 },
  { id: 2, title: 'Complete one practice set', target_date: isoDate(), is_completed: 0, progress: 35 },
  { id: 3, title: 'Revise organic chemistry', target_date: isoDate(1), is_completed: 0, progress: 0 },
];

const getStored = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
};

const setStored = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

const formValue = (payload: unknown, key: string) => {
  if (payload instanceof FormData) return payload.get(key)?.toString() || '';
  if (payload && typeof payload === 'object' && key in payload) return String((payload as Record<string, unknown>)[key] ?? '');
  return '';
};

const delay = () => new Promise((resolve) => setTimeout(resolve, 90));

const get = async <T = any>(action: string, options?: { params?: Record<string, unknown>; headers?: Record<string, unknown> }): LocalResponse<T> => {
  await delay();
  const query = new URLSearchParams(action.includes('?') ? action.split('?')[1] : '');
  const params = { ...Object.fromEntries(query), ...(options?.params || {}) };

  if (action.includes('dashboard-stats') || action.includes('get_dashboard_stats')) {
    if (action.includes('quiz') || action.includes('student_quiz')) return { data: { status: 'success', totalQuizzes: 7, avgScore: 78.4, recentRank: 'Aspirant', completedTargets: 1, streak: 6 } as T };
    return { data: { status: 'success', streak: 6, completedTargets: 1, activeQuizzes: [] } as T };
  }
  if (action.includes('subjects')) {
    if (action.includes('exams') || params.action === 'exams') return { data: { success: true, exams: [{ id: 1, exam_name: 'B.Sc. CSIT' }, { id: 2, exam_name: 'CMAT' }, { id: 3, exam_name: 'IOE' }] } as T };
    if (action.includes('init') || params.action === 'init') return { data: { success: true, classes: ['class8', 'class9', 'class10', 'class11', 'class12'], faculties: ['Science', 'Management', 'Humanities'] } as T };
    return { data: { success: true, subjects: DEMO_SUBJECTS } as T };
  }
  if (action.includes('resources')) {
    const subject = String(params.subject || '').toLowerCase();
    const resources = subject ? DEMO_RESOURCES.filter((item) => item.subjectName.toLowerCase() === subject) : DEMO_RESOURCES;
    return { data: { success: true, resources } as T };
  }
  if (action.includes('targets')) return { data: { status: 'success', targets: getStored('nl_targets', DEFAULT_TARGETS) } as T };
  if (action.includes('test-series-collections') || action.includes('get_test_series_collections')) return { data: { status: 'true', data: DEMO_COLLECTIONS } as T };
  if (action.includes('check-access') || action.includes('check_access')) return { data: { status: 'true', data: getStored('nl_access', [1, 2]), pending: [] } as T };
  if (action.includes('collection-content') || action.includes('get_collection_content')) return { data: { status: 'true', data: DEMO_QUIZZES, has_access: true } as T };
  if (action.includes('quiz-data') || action.includes('get_quiz_data')) return { data: { status: 'true', data: { id: Number(params.quiz_id || 101), title: 'Full mock test 01', time_limit: 20, negative_marking: 0.25, mode: 'PRACTICE', questions: DEMO_QUESTIONS, attempt_count: 0, quiz_session_id: `local-${Date.now()}` } } as T };
  if (action.includes('history') || action.includes('get_quiz_history')) return { data: { status: 'true', data: { highScore: 82, history: [{ id: 7001, score: 3, total_marks: 4, percentage: 75, created_at: `${isoDate(-3)} 14:20:00` }] } } as T };
  if (action.includes('attempt-details') || action.includes('get_attempt_details')) return { data: { status: 'true', quiz_title: 'Full mock test 01', summary: { id: 7001, quiz_id: 101, collection_id: 1, score: 3, total_marks: 4, correct_answers: 3, wrong_answers: 1, unanswered: 0, percentage: 75, time_taken: 642, attempt_json: DEMO_QUESTIONS }, details: [] } as T };
  if (action.includes('leaderboard')) return { data: { status: 'true', data: [{ rank: 1, user_name: 'Aarav Shrestha', score: 92, time_taken: 680 }, { rank: 2, user_name: 'Nisha Karki', score: 88, time_taken: 704 }, { rank: 3, user_name: 'Prabin Wagle', score: 82, time_taken: 729 }] } as T };
  if (action.includes('blogs') || action.includes('getblogs')) return { data: { status: 'true', data: DEMO_BLOGS } as T };
  if (action.includes('blog') || action.includes('getblog')) return { data: { status: 'true', data: DEMO_BLOGS.find((blog) => blog.slug === params.slug) || DEMO_BLOGS[0] } as T };
  if (action.includes('books') || action.includes('getallbooks')) return { data: { status: 'true', data: DEMO_RESOURCES.filter((item) => ['Physics', 'Chemistry', 'Mathematics'].includes(item.subjectName)).map((item, index) => ({ ...item, id: 20 + index, chapterName: `${item.subjectName} study book`, resource_type: 'book' })) } as T };
  if (action.includes('performance-history') || action.includes('get_performance_history')) return { data: { status: 'success', attempts: [{ date: isoDate(-20), score: 28, total: 50 }, { date: isoDate(-12), score: 34, total: 50 }, { date: isoDate(-4), score: 39, total: 50 }] } as T };
  if (action.includes('notifications')) return { data: { status: 'success', notifications: [{ id: 1, title: 'Study plan ready', message: 'Your weekly targets are ready to review.', is_read: 0, created_at: `${isoDate()} 08:00:00` }] } as T };
  if (action.includes('lofi')) return { data: { status: 'success', data: [] } as T };
  if (action.includes('tickets')) return { data: { status: 'success', tickets: getStored('nl_tickets', [{ id: 1, subject: 'How do I revisit a test?', message: 'I want to review my previous attempt.', admin_reply: 'Open Test series, choose the collection, then select Latest result.', status: 'answered', created_at: `${isoDate(-4)} 10:30:00`, updated_at: `${isoDate(-3)} 09:10:00` }]) } as T };
  return { data: { status: 'true', success: true, data: DEMO_RESOURCES, subjects: DEMO_SUBJECTS } as T };
};

const post = async <T = any>(action: string, payload?: unknown): LocalResponse<T> => {
  await delay();
  if (action.includes('update-profile')) {
    const current = getStored<Record<string, unknown>>('nl_frontend_user', {});
    const fields = ['name', 'username', 'email', 'phNo', 'province', 'district', 'city', 'class', 'faculty', 'competition'];
    const updates = Object.fromEntries(fields.map((field) => [field, formValue(payload, field)]).filter(([, value]) => value));
    const user = { ...current, ...updates };
    setStored('nl_frontend_user', user);
    setStored('user', user);
    return { data: { status: 'success', user, token: 'local-session' } as T };
  }
  if (action.includes('targets')) {
    const targets = getStored<Array<(typeof DEFAULT_TARGETS)[number]>>('nl_targets', DEFAULT_TARGETS);
    const operation = formValue(payload, 'action');
    const id = Number(formValue(payload, 'target_id'));
    if (operation === 'add') targets.push({ id: Date.now(), title: formValue(payload, 'title'), target_date: formValue(payload, 'target_date') || isoDate(), is_completed: 0, progress: 0 });
    if (operation === 'update_progress') targets.forEach((target) => { if (Number(target.id) === id) { target.progress = Number(formValue(payload, 'progress')); target.is_completed = target.progress >= 100 ? 1 : 0; } });
    if (operation === 'delete') setStored('nl_targets', targets.filter((target) => Number(target.id) !== id)); else setStored('nl_targets', targets);
    return { data: { status: 'success' } as T };
  }
  if (action.includes('store-result') || action.includes('store_quiz_result')) return { data: { status: 'true', attempt_id: 7001 } as T };
  if (action.includes('enroll')) {
    const id = Number(formValue(payload, 'collection_id'));
    const access = Array.from(new Set([...getStored<number[]>('nl_access', [1, 2]), id]));
    setStored('nl_access', access);
    return { data: { status: 'true', message: 'Collection added to your library.' } as T };
  }
  if (action.includes('promo') || action.includes('validate')) return { data: { success: formValue(payload, 'code').toUpperCase() === 'STUDY20', discount_percent: '20', message: 'Use STUDY20 for the demo discount.' } as T };
  if (action.includes('payment') || action.includes('submit')) return { data: { status: 'true', statusText: 'success', message: 'Demo submission saved locally.' } as T };
  if (action.includes('support')) return { data: { status: 'success', message: 'Your note was saved in this browser.' } as T };
  return { data: { status: action.includes('competitive') || action.includes('datafetch') ? 'true' : 'success', success: true, message: 'Saved locally.', data: DEMO_RESOURCES, subjects: DEMO_SUBJECTS } as T };
};

const localData = { get, post };
export default localData;
