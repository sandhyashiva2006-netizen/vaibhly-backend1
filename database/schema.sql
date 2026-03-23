-- =========================================
-- EduNexa LMS Database Schema
-- PostgreSQL
-- =========================================

-- USERS TABLE
-- Roles: admin, instructor, student
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- COURSES TABLE
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    price INTEGER DEFAULT 0,
    duration INTEGER,
    thumbnail VARCHAR(255),
    course_type VARCHAR(10) CHECK (course_type IN ('free', 'paid')),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- COURSE CONTENT (VIDEOS / PDFS)
CREATE TABLE course_content (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    content_type VARCHAR(20) CHECK (content_type IN ('video', 'pdf')),
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EXAMS TABLE
CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    total_questions INTEGER,
    time_limit INTEGER,          -- in minutes
    pass_percentage INTEGER,
    attempts_allowed INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QUESTIONS (MCQ)
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) CHECK (correct_option IN ('A','B','C','D'))
);

-- STUDENT EXAM RESULTS
CREATE TABLE results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    score INTEGER,
    status VARCHAR(10) CHECK (status IN ('pass','fail')),
    attempts INTEGER DEFAULT 1,
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CERTIFICATES TABLE
CREATE TABLE certificates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    certificate_id VARCHAR(50) UNIQUE,
    issued_on DATE DEFAULT CURRENT_DATE
);

-- OPTIONAL: ENROLLMENTS TABLE
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- INDEXES (Performance)
-- =========================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_courses_category ON courses(category);
CREATE INDEX idx_results_user ON results(user_id);
CREATE INDEX idx_certificates_certid ON certificates(certificate_id);
