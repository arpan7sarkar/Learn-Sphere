// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const API_ENDPOINTS = {
  // Course endpoints
  COURSES: `${API_BASE_URL}/courses`,
  GENERATE_COURSE: `${API_BASE_URL}/courses`,
  DELETE_COURSE: (courseId: string, userId: string) => `${API_BASE_URL}/courses?courseId=${courseId}&userId=${userId}`,
  
  // XP endpoints
  GET_USER_XP: (userId: string) => `${API_BASE_URL}/xp?action=user&userId=${userId}`,
  ADD_XP: `${API_BASE_URL}/xp?action=add`,
  COMPLETE_LESSON: `${API_BASE_URL}/xp?action=lesson-complete`,
  COMPLETE_QUIZ: `${API_BASE_URL}/xp?action=quiz-complete`,
  REGENERATE_QUIZ: `${API_BASE_URL}/xp?action=quiz-regenerate`,
  
  // Chat endpoint
  CHAT: `${API_BASE_URL}/chat`,
};

export default API_ENDPOINTS;
