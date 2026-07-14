// src/api/client.js
// Drop this into your LearnersForge React project
// Import functions from here instead of calling fetch() directly

import axios from 'axios';

// API base URL. Override per-environment with VITE_API_BASE (see .env.production).
// Falls back to the local XAMPP path for development.
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost/learnersforge/public/api/v1';

const api = axios.create({ baseURL: BASE, withCredentials: true });

// Attach token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('lf_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Global error handler
api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lf_token');
      window.dispatchEvent(new Event('lf-unauthorized'));
    }
    return Promise.reject(err.response?.data || err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login  = (email, password) =>
  api.post('/auth/login', { email, password }).then(d => {
    const token = d?.data?.token
               || d?.data?.access_token
               || d?.token
               || d?.access_token;
    if (!token) {
      console.error('Login response missing token. Full response:', d);
      throw new Error('Login succeeded but no token was found in the response. Open DevTools → Network → /auth/login and share the response body.');
    }
    localStorage.setItem('lf_token', token);
    return d?.data || d;
  });
export const logout = () => { localStorage.removeItem('lf_token'); };
export const getMe  = () => api.get('/auth/me');

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard = () => api.get('/dashboard');

// ── Students ──────────────────────────────────────────────────────────────────
export const getStudents  = (params = {}) => api.get('/students', { params });
export const getStudent   = id => api.get(`/students/${id}`);
export const createStudent = data => api.post('/students', data);
export const importStudents = (class_id, students) => api.post('/students/import', { class_id, students });
export const updateStudent = (id, data) => api.put(`/students/${id}`, data);
export const deleteStudent = id => api.delete(`/students/${id}`);
export const bulkDeleteStudents = ids => api.post('/students/bulk-delete', { ids });

// ── Staff ─────────────────────────────────────────────────────────────────────
export const getStaff   = () => api.get('/staff');
export const getStaffMember = id => api.get(`/staff/${id}`);
export const createStaff = data => api.post('/staff', data);
export const getStaffAssignments  = id => api.get(`/staff/${id}/assignments`);
export const saveStaffAssignments = (id, data) => api.post(`/staff/${id}/assignments`, data);
export const deleteStaff = id => api.delete(`/staff/${id}`);

// ── Attendance ────────────────────────────────────────────────────────────────
export const getAttendance    = (class_id, date, term_id = 2) =>
  api.get('/attendance', { params: { class_id, date, term_id } });
export const submitAttendance = (records, class_id, term_id = 2, date) =>
  api.post('/attendance/bulk', { records, class_id, term_id, date });
export const getAttendanceSummary = (student_id, term_id = 2) =>
  api.get('/attendance/summary', { params: { student_id, term_id } });
// Per-term manual totals (present / absent / days opened) shown on the report card.
export const getTermAttendance  = (class_id, term_id) =>
  api.get('/attendance/term-summary', { params: { class_id, term_id } });
export const saveTermAttendance = (class_id, term_id, records) =>
  api.post('/attendance/term-summary', { class_id, term_id, records });

// ── AI (z.ai proxy — key stays server-side) ─────────────────────────────────────
// Generic completion: pass { prompt, system?, messages?, model?, temperature?, max_tokens? }.
// Returns { content, model, usage }.
export const aiChat = payload => api.post('/ai/chat', payload).then(r => r?.data ?? r);

// ── Grades ────────────────────────────────────────────────────────────────────
export const getCaTypes     = () => api.get('/ca-types');
export const getGrades      = (params = {}) => api.get('/grades', { params });
export const submitGrades   = grades => api.post('/grades/bulk', { grades });
export const getReportCard  = (student_id, term_id = 2) =>
  api.get('/grades/report-card', { params: { student_id, term_id } });
export const getCumulative  = (student_id, term_ids = '1,2') =>
  api.get('/grades/cumulative', { params: { student_id, term_ids } });
export const getBehaviour   = (params = {}) => api.get('/behaviour', { params });
export const saveBehaviour  = records => api.post('/behaviour/bulk', { records });
export const getComments    = (params = {}) => api.get('/comments', { params });
export const saveComments   = comments => api.post('/comments/bulk', { comments });

// ── Report-card remark ranges (admin) ───────────────────────────────────────────
export const getRemarkRanges   = (params = {}) => api.get('/remark-ranges', { params });
export const createRemarkRange = data => api.post('/remark-ranges', data);
export const updateRemarkRange = (id, data) => api.put(`/remark-ranges/${id}`, data);
export const deleteRemarkRange = id => api.delete(`/remark-ranges/${id}`);

// ── Fees ──────────────────────────────────────────────────────────────────────
export const getInvoices      = (params = {}) => api.get('/fees/invoices', { params });
export const recordPayment    = data => api.post('/fees/payments', data);
export const getExpenses      = () => api.get('/fees/expenses');
export const addExpense       = data => api.post('/fees/expenses', data);
export const getPayroll       = (month, year) =>
  api.get('/fees/payroll', { params: { month, year } });
export const getFeeSummary    = (term_id = 2) =>
  api.get('/fees/summary', { params: { term_id } });

// ── Timetable ─────────────────────────────────────────────────────────────────
export const getTimetable  = (class_id, term_id = 2) =>
  api.get('/timetable', { params: { class_id, term_id } });
export const saveTimetable = (class_id, term_id, slots) =>
  api.post('/timetable', { class_id, term_id, slots });

// ── Exams ─────────────────────────────────────────────────────────────────────
export const getExams    = () => api.get('/exams');
export const getExam     = id => api.get(`/exams/${id}`);
export const createExam  = data => api.post('/exams', data);
export const updateExam  = (id, data) => api.put(`/exams/${id}`, data);
export const submitExam  = data => api.post('/exams/submit', data);
export const addExamQuestions = (id, questions) => api.post(`/exams/${id}/questions`, { questions });
export const deleteExam  = id => api.delete(`/exams/${id}`);
export const updateExamMeta = (id, data) => api.put(`/exams/${id}`, data);
// Teacher grading / results
export const getExamSubmissions = examId => api.get(`/exams/${examId}/submissions`);
export const getSubmission      = subId  => api.get(`/submissions/${subId}`);
export const gradeSubmission    = (subId, scores) => api.post(`/submissions/${subId}/grade`, { scores });

// ── Student portal (exam taking) ────────────────────────────────────────────────
export const getMyExams       = () => api.get('/my/exams');
export const getMyExam        = id => api.get(`/my/exams/${id}`);
export const submitMyExam     = (exam_id, answers, time_taken = 0) =>
  api.post('/my/exam-submit', { exam_id, answers, time_taken });
export const getMyResults     = () => api.get('/my/results');

// ── Inventory ─────────────────────────────────────────────────────────────────
export const getInventory    = (category = '') =>
  api.get('/inventory', { params: category ? { category } : {} });
export const createItem      = data => api.post('/inventory', data);
export const issueItem       = data => api.post('/inventory/issue', data);
export const restockItem     = data => api.post('/inventory/restock', data);
export const getTransactions = (item_id) =>
  api.get('/inventory/transactions', { params: item_id ? { item_id } : {} });

// ── Hostel ────────────────────────────────────────────────────────────────────
export const getHostels    = () => api.get('/hostels');
export const getRooms      = (hostel_id, term_id = 2) =>
  api.get('/hostel/rooms', { params: { hostel_id, term_id } });
export const allocateRoom  = data => api.post('/hostel/allocate', data);
export const getVisitors   = () => api.get('/hostel/visitors');
export const logVisitor    = data => api.post('/hostel/visitors', data);

// ── Library ───────────────────────────────────────────────────────────────────
export const getBooks      = () => api.get('/library/books');
export const getLoans      = () => api.get('/library/loans');
export const issueBook     = data => api.post('/library/issue', data);
export const returnBook    = loan_id => api.post('/library/return', { loan_id });

// ── Messaging ─────────────────────────────────────────────────────────────────
export const getMessages     = () => api.get('/messages');
export const sendMessage     = data => api.post('/messages', data);
export const getNotifications = () => api.get('/notifications');

// ── Admissions ────────────────────────────────────────────────────────────────
export const getApplications   = () => api.get('/admissions');
export const submitApplication = data => api.post('/admissions', data);
export const updateApplication = (id, status) =>
  api.put(`/admissions/${id}`, { status });

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSchoolSettings    = () => api.get('/settings/school');
export const updateSchoolSettings = data => api.put('/settings/school', data);

// ── Utilities ─────────────────────────────────────────────────────────────────
export const getClasses  = () => api.get('/classes');
export const createClass = data => api.post('/classes', data);
export const getSubjects = () => api.get('/subjects');
export const getTerms    = () => api.get('/terms');

export default api;
