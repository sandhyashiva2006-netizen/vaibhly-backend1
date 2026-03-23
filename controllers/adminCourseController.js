const pool = require("../config/db");

/* ================= COURSES ================= */

exports.getCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let result;

    // 👑 Admin sees all courses
    if (role === "admin") {
      result = await pool.query(
        `SELECT * FROM courses ORDER BY created_at DESC`
      );
    }

    // 👨‍🏫 Instructor sees only their courses
    else if (role === "instructor") {
      result = await pool.query(
        `
        SELECT *
        FROM courses
        WHERE instructor_id = $1
        ORDER BY created_at DESC
        `,
        [userId]
      );
    }

    else {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json(result.rows);

  } catch (err) {
    console.error("Get courses error:", err);
    res.status(500).json({ error: "Failed to load courses" });
  }
};


exports.createCourse = async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const instructorId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: "Title required" });
    }

    const result = await pool.query(
      `
      INSERT INTO courses (title, description, price, status, instructor_id)
      VALUES ($1, $2, $3, 'draft', $4)
      RETURNING *
      `,
      [title, description || "", price || 0, instructorId]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Create course error:", err);
    res.status(500).json({ error: "Failed to create course" });
  }
};


/* ================= MODULES ================= */

exports.getModules = async (req, res) => {
  try {
    const { course_id } = req.query;

    const result = await pool.query(
      `
      SELECT * FROM modules
      WHERE course_id = $1
      ORDER BY position ASC
      `,
      [course_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get modules error:", err);
    res.status(500).json({ error: "Failed to load modules" });
  }
};

exports.createModule = async (req, res) => {
  try {
    const { course_id, title, description } = req.body;

    const posRes = await pool.query(
      `SELECT COALESCE(MAX(position),0)+1 AS pos FROM modules WHERE course_id=$1`,
      [course_id]
    );

    const position = posRes.rows[0].pos;

    const result = await pool.query(
      `
      INSERT INTO modules (course_id, title, description, position)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [course_id, title, description || "", position]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create module error:", err);
    res.status(500).json({ error: "Failed to create module" });
  }
};

/* ================= LESSONS ================= */

exports.getLessons = async (req, res) => {
  try {
    const { module_id } = req.query;

    const result = await pool.query(
      `
      SELECT * FROM lessons
      WHERE module_id = $1
      ORDER BY position ASC
      `,
      [module_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get lessons error:", err);
    res.status(500).json({ error: "Failed to load lessons" });
  }
};

exports.createLesson = async (req, res) => {
  try {
    const { module_id, title, content, video_url } = req.body;

    const posRes = await pool.query(
      `SELECT COALESCE(MAX(position),0)+1 AS pos FROM lessons WHERE module_id=$1`,
      [module_id]
    );

    const position = posRes.rows[0].pos;

    const result = await pool.query(
      `
      INSERT INTO lessons (module_id, title, content, video_url, position)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [module_id, title, content || "", video_url || "", position]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create lesson error:", err);
    res.status(500).json({ error: "Failed to create lesson" });
  }
};

/* ================= UPDATE COURSE ================= */

exports.updateCourse = async (req, res) => {
  try {
    const { id, title, description, price } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (role === "instructor") {
      const check = await pool.query(
        `SELECT id FROM courses WHERE id = $1 AND instructor_id = $2`,
        [id, userId]
      );

      if (!check.rows.length) {
        return res.status(403).json({ error: "Not allowed" });
      }
    }

    await pool.query(
      `
      UPDATE courses
      SET title=$1, description=$2, price=$3
      WHERE id=$4
      `,
      [title, description, price, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Update course error:", err);
    res.status(500).json({ error: "Failed to update course" });
  }
};


/* ================= DELETE COURSE ================= */

exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    if (role === "instructor") {
      const check = await pool.query(
        `SELECT id FROM courses WHERE id = $1 AND instructor_id = $2`,
        [id, userId]
      );

      if (!check.rows.length) {
        return res.status(403).json({ error: "Not allowed" });
      }
    }

    await pool.query("DELETE FROM courses WHERE id = $1", [id]);
    res.json({ success: true });

  } catch (err) {
    console.error("Delete course error:", err);
    res.status(500).json({ error: "Failed to delete course" });
  }
};


/* ================= UPDATE MODULE ================= */

exports.updateModule = async (req, res) => {
  try {
    const { id, title } = req.body;

    await pool.query(
      `UPDATE modules SET title=$1 WHERE id=$2`,
      [title, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Update module error:", err);
    res.status(500).json({ error: "Failed to update module" });
  }
};

/* ================= DELETE MODULE ================= */

exports.deleteModule = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM modules WHERE id=$1`, [id]);
    res.json({ success: true });

  } catch (err) {
    console.error("Delete module error:", err);
    res.status(500).json({ error: "Failed to delete module" });
  }
};

/* ================= UPDATE LESSON ================= */

exports.updateLesson = async (req, res) => {
  try {
    const { id, title, content, video_url } = req.body;

    await pool.query(
      `
      UPDATE lessons
      SET title=$1, content=$2, video_url=$3
      WHERE id=$4
      `,
      [title, content, video_url, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Update lesson error:", err);
    res.status(500).json({ error: "Failed to update lesson" });
  }
};

/* ================= DELETE LESSON ================= */

exports.deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM lessons WHERE id=$1`, [id]);
    res.json({ success: true });

  } catch (err) {
    console.error("Delete lesson error:", err);
    res.status(500).json({ error: "Failed to delete lesson" });
  }
};

/* ================= REORDER MODULES ================= */

exports.reorderModules = async (req, res) => {
  try {
    const { items } = req.body;

    for (const item of items) {
      await pool.query(
        `UPDATE modules SET position=$1 WHERE id=$2`,
        [item.position, item.id]
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Reorder modules error:", err);
    res.status(500).json({ error: "Failed to reorder modules" });
  }
};

/* ================= REORDER LESSONS ================= */

exports.reorderLessons = async (req, res) => {
  try {
    const { items } = req.body;

    for (const item of items) {
      await pool.query(
        `UPDATE lessons SET position=$1 WHERE id=$2`,
        [item.position, item.id]
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Reorder lessons error:", err);
    res.status(500).json({ error: "Failed to reorder lessons" });
  }
};

/* ================= TOGGLE COURSE PUBLISH ================= */

exports.togglePublish = async (req, res) => {
  try {
    const { id, is_published } = req.body;

    await pool.query(
      `UPDATE courses SET is_published=$1 WHERE id=$2`,
      [is_published, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Toggle publish error:", err);
    res.status(500).json({ error: "Failed to update publish status" });
  }
};
